import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultTimeouts,
  durationPresets,
  resolveDuration,
} from '../src/core/defaults';
import { __resetStore, getState, resolveToast } from '../src/core/store';
import { toast } from '../src/core/toast';
import { __resetIdCounter, genId } from '../src/core/ids';
import type { DurationPreset, Toast } from '../src/core/types';

const baseToast = (over: Partial<Toast> = {}): Toast => ({
  type: 'blank',
  id: genId(),
  message: 'hi',
  pauseDuration: 0,
  // Derived by the queue in production: the anchor the toast resolved to, and its
  // place in that anchor's stack.
  resolvedPosition: 'top-center',
  depth: 0,
  createdAt: Date.now(),
  visible: true,
  dismissed: false,
  ...over,
});

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
});

/**
 * `'short' | 'long' | 'infinite'` borrows the snackbar vocabulary, which two
 * unrelated libraries had already converged on. The numbers are the contract
 * though, so they are pinned here rather than left to drift.
 */
describe('durationPresets', () => {
  it('maps the three presets to their documented values', () => {
    expect(durationPresets.short).toBe(2000);
    expect(durationPresets.long).toBe(4500);
    expect(durationPresets.infinite).toBe(Infinity);
  });

  it('is exhaustive over the DurationPreset union', () => {
    // A new member of the union that nobody added a number for would resolve to
    // undefined and become `NaN` milliseconds of silence.
    const presets: DurationPreset[] = ['short', 'long', 'infinite'];
    expect(Object.keys(durationPresets).sort()).toEqual([...presets].sort());
    for (const preset of presets) {
      expect(typeof resolveDuration(preset, 1)).toBe('number');
    }
  });

  it('keeps long comfortably longer than short', () => {
    // The gap is what makes the two presets worth choosing between.
    expect(durationPresets.long).toBeGreaterThan(durationPresets.short * 2);
  });
});

describe('resolveDuration', () => {
  it('falls back when nothing was requested', () => {
    expect(resolveDuration(undefined, 4000)).toBe(4000);
    expect(resolveDuration(undefined, Infinity)).toBe(Infinity);
  });

  it('passes a number through exactly', () => {
    // react-hot-toast parity: a number is still a number, with no rounding, no
    // clamping and no minimum.
    expect(resolveDuration(0, 4000)).toBe(0);
    expect(resolveDuration(1, 4000)).toBe(1);
    expect(resolveDuration(999, 4000)).toBe(999);
    expect(resolveDuration(60_000, 4000)).toBe(60_000);
    expect(resolveDuration(Infinity, 4000)).toBe(Infinity);
  });

  it('resolves each preset, ignoring the fallback entirely', () => {
    expect(resolveDuration('short', 4000)).toBe(2000);
    expect(resolveDuration('long', 4000)).toBe(4500);
    expect(resolveDuration('infinite', 4000)).toBe(Infinity);
    // The fallback is a number of milliseconds; it must not win over a request.
    expect(resolveDuration('short', 10)).toBe(2000);
  });
});

describe('resolveToast — symbolic durations', () => {
  it("resolves a per-toast 'short' to 2000", () => {
    expect(resolveToast(baseToast({ durationPreset: 'short' })).duration).toBe(2000);
  });

  it("resolves a per-toast 'long' to 4500", () => {
    expect(resolveToast(baseToast({ durationPreset: 'long' })).duration).toBe(4500);
  });

  it("resolves a per-toast 'infinite' to Infinity", () => {
    expect(resolveToast(baseToast({ durationPreset: 'infinite' })).duration).toBe(Infinity);
  });

  it('keeps the original preset alongside the resolved number', () => {
    // The settings and Toaster layers read `durationPreset`; resolving must not
    // erase it, or a re-resolve would lose the caller's intent.
    const resolved = resolveToast(baseToast({ durationPreset: 'long' }));
    expect(resolved.durationPreset).toBe('long');
    expect(resolved.duration).toBe(4500);
  });

  it('lets a numeric duration beat the per-type default table', () => {
    expect(resolveToast(baseToast({ type: 'blank', duration: 1500 })).duration).toBe(1500);
    // Success is 2000 by default, so this also proves the number is not simply
    // landing on the same value by accident.
    expect(resolveToast(baseToast({ type: 'success', duration: 1500 })).duration).toBe(1500);
  });

  it('falls back to the per-type table when no duration was requested', () => {
    for (const [type, expected] of Object.entries(defaultTimeouts)) {
      const resolved = resolveToast(baseToast({ type: type as Toast['type'] }));
      expect(resolved.duration).toBe(expected);
    }
  });

  it("beats the per-type default table with a per-toast symbolic duration", () => {
    // Success defaults to 2000; 'long' has to win over it, which means the
    // preset has to be resolved after the type table is consulted.
    const resolved = resolveToast(baseToast({ type: 'success', durationPreset: 'long' }), {
      success: { duration: 'short' },
    });

    expect(resolved.duration).toBe(4500);
    expect(resolved.duration).not.toBe(defaultTimeouts.success);
  });

  it('resolves a per-type symbolic default when the toast has none', () => {
    const resolved = resolveToast(baseToast({ type: 'success' }), {
      duration: 1000,
      success: { duration: 'long' },
    });

    expect(resolved.duration).toBe(4500);
  });

  it('resolves a Toaster-level symbolic default', () => {
    expect(resolveToast(baseToast(), { duration: 'long' }).duration).toBe(4500);
  });

  it("does not leave a stale numeric duration behind for a symbolic request", () => {
    // `createToast` splits the request into durationPreset (symbolic) or duration
    // (numeric). Carrying both would let the number shadow the preset on a later
    // resolve, since the numeric field is read first.
    toast('symbolic', { duration: 'long' });
    toast('numeric', { duration: 1234 });

    // Store arrays are newest-first.
    const numeric = getState().toasts[0]!;
    expect(numeric.message).toBe('numeric');
    expect(numeric.duration).toBe(1234);
    expect(numeric.durationPreset).toBeUndefined();

    const symbolic = getState().toasts[1]!;
    expect(symbolic.message).toBe('symbolic');
    expect(symbolic.durationPreset).toBe('long');
    expect(symbolic.duration).toBeUndefined();
  });

  it('round-trips a symbolic duration through the store', () => {
    toast('forever', { duration: 'infinite' });
    toast('brief', { duration: 'short' });

    expect(resolveToast(getState().toasts[0]!).duration).toBe(2000);
    expect(resolveToast(getState().toasts[1]!).duration).toBe(Infinity);
  });
});
