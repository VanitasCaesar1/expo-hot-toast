import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../src/core/toast';
import {
  DEFAULT_DEDUPE_WINDOW,
  __resetStore,
  findDedupeHit,
  getState,
  recordDedupe,
} from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';

/**
 * A spinner that reports progress twenty times a second used to produce twenty
 * stacked toasts. Dedupe is the fix, and the whole contract hangs on one
 * question: given the same `dedupeKey` twice in quick succession, does the caller
 * get the id of the toast already on screen instead of a second toast?
 */
beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('dedupe', () => {
  it('returns the existing id and adds no toast for a live key', () => {
    const first = toast('Uploading', { dedupeKey: 'upload' });
    const second = toast('Uploading', { dedupeKey: 'upload' });

    // The point of returning an id rather than void: the caller can transition the
    // toast it just found instead of adding one.
    expect(second).toBe(first);
    expect(getState().toasts).toHaveLength(1);
    expect(getState().toasts[0]!.id).toBe(first);
  });

  it('reports the same id for a whole burst inside the window', () => {
    const ids = new Set<string>();
    for (let tick = 0; tick < 25; tick += 1) {
      vi.advanceTimersByTime(20);
      ids.add(toast(`${tick}%`, { dedupeKey: 'upload' }));
    }

    // Twenty-five calls, one toast, one id: a progress spinner has to be able to
    // update in place rather than accumulate.
    expect(ids.size).toBe(1);
    expect(getState().toasts).toHaveLength(1);
  });

  it('creates a new toast once the window has passed', () => {
    const first = toast('Uploading', { dedupeKey: 'upload' });

    // findDedupeHit expires on `now - at > windowMs`, so the boundary is
    // exclusive: exactly at the window it is still a hit.
    vi.advanceTimersByTime(DEFAULT_DEDUPE_WINDOW);
    expect(toast('Uploading', { dedupeKey: 'upload' })).toBe(first);
    expect(getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    const later = toast('Uploading again', { dedupeKey: 'upload' });
    expect(later).not.toBe(first);
    expect(getState().toasts).toHaveLength(2);
  });

  it('honours a per-call dedupeWindowMs', () => {
    // A toast that wants "never stack two of me" needs a far longer window than
    // the 1s default, and the option has to actually shorten as well as extend.
    const first = toast('Saving', { dedupeKey: 'save', dedupeWindowMs: 60_000 });

    vi.advanceTimersByTime(30_000);
    expect(toast('Saving', { dedupeKey: 'save', dedupeWindowMs: 60_000 })).toBe(first);

    vi.advanceTimersByTime(30_001);
    expect(toast('Saving', { dedupeKey: 'save', dedupeWindowMs: 60_000 })).not.toBe(first);

    // A short window on the same key expires almost immediately. The comparison
    // has to be against the id the short-window call itself created — comparing to
    // `first` would pass whether or not the option was honoured.
    const shortWindowed = toast('Saving', { dedupeKey: 'save', dedupeWindowMs: 50 });
    vi.advanceTimersByTime(51);
    expect(toast('Saving', { dedupeKey: 'save', dedupeWindowMs: 50 })).not.toBe(shortWindowed);
  });

  it('never dedupes on message text alone', () => {
    // The dangerous regression: deduping by content would silently swallow a
    // second "Item deleted" for a *different* item, and the user would never know
    // it happened. Identity is opt-in, through the key.
    const first = toast('Item deleted');
    const second = toast('Item deleted');

    expect(second).not.toBe(first);
    expect(getState().toasts).toHaveLength(2);
  });

  it('does not dedupe two toasts that share a message but not a key', () => {
    const first = toast('Saved', { dedupeKey: 'doc-1' });
    const second = toast('Saved', { dedupeKey: 'doc-2' });

    expect(second).not.toBe(first);
    expect(getState().toasts).toHaveLength(2);
  });

  it('scopes dedupe to a toasterId', () => {
    // Two regions showing the same key are two independent queues. Sharing a
    // registry would let a toast in an off-screen region swallow the one the
    // user is actually looking at.
    const main = toast('Working', { toasterId: 'main', dedupeKey: 'job' });
    const sidebar = toast('Working', { toasterId: 'sidebar', dedupeKey: 'job' });

    expect(sidebar).not.toBe(main);
    expect(getState('main').toasts).toHaveLength(1);
    expect(getState('sidebar').toasts).toHaveLength(1);

    // And each region dedupes against itself only.
    expect(toast('Working', { toasterId: 'main', dedupeKey: 'job' })).toBe(main);
    expect(toast('Working', { toasterId: 'sidebar', dedupeKey: 'job' })).toBe(sidebar);
  });

  it('dedupes across toast types', () => {
    // The key identifies a thing on screen, not a call site: a spinner reporting
    // progress and then reporting failure must update, not stack.
    const loading = toast.loading('Uploading', { dedupeKey: 'upload' });
    const success = toast.success('Uploaded', { dedupeKey: 'upload' });

    expect(success).toBe(loading);
    expect(getState().toasts).toHaveLength(1);
    expect(getState().toasts[0]!.type).toBe('loading');
  });

  it('bounds the registry instead of growing without limit', () => {
    // An unbounded Map keyed on arbitrary user input is a slow leak in a
    // component whose whole job is to avoid allocating. MAX_DEDUPE_ENTRIES is
    // 500, so 600 distinct keys leave exactly 500 live — and the evicted ones are
    // the oldest, which is what insertion-ordered eviction buys.
    for (let i = 0; i < 600; i += 1) {
      toast(`message ${i}`, { toasterId: 'bounded', dedupeKey: `key-${i}` });
    }

    const live = Array.from({ length: 600 }, (_, i) => i).filter((i) =>
      Boolean(findDedupeHit('bounded', `key-${i}`, DEFAULT_DEDUPE_WINDOW)),
    );

    expect(live).toHaveLength(500);
    expect(live[0]).toBe(100);
    expect(live.at(-1)).toBe(599);
    // The oldest key was sacrificed, not the newest.
    expect(findDedupeHit('bounded', 'key-0', DEFAULT_DEDUPE_WINDOW)).toBeNull();
  });

  it('keeps the registry per toasterId rather than evicting across regions', () => {
    // Eviction is per registry, so one chatty region cannot flush another's keys.
    for (let i = 0; i < 600; i += 1) {
      toast('chatty', { toasterId: 'chatty', dedupeKey: `key-${i}` });
    }
    recordDedupe('quiet', 'keep-me', 'toast-1');

    expect(findDedupeHit('quiet', 'keep-me', DEFAULT_DEDUPE_WINDOW)).toBe('toast-1');
  });
});

/**
 * `findDedupeHit` and `recordDedupe` are the registry's only surface, and both
 * take an explicit `now` for exactly this reason: expiry is pure arithmetic, so
 * it is worth pinning without a clock.
 */
describe('dedupe registry primitives', () => {
  it('treats the window as inclusive at its boundary and expired past it', () => {
    recordDedupe('r', 'k', 'toast-1', 1_000);

    expect(findDedupeHit('r', 'k', 1_000, 2_000)).toBe('toast-1');
    expect(findDedupeHit('r', 'k', 1_000, 2_001)).toBeNull();
    // The miss evicted the entry, so it cannot come back to life.
    expect(findDedupeHit('r', 'k', 1_000, 2_000)).toBeNull();
  });

  it('misses for a key it has never seen', () => {
    expect(findDedupeHit('r', 'never', 1_000, 0)).toBeNull();
    expect(findDedupeHit('nobody', 'never', 1_000, 0)).toBeNull();
  });

  it('moves a re-recorded key to the newest end so eviction stays oldest-first', () => {
    recordDedupe('r', 'old', 'toast-old', 1_000);
    recordDedupe('r', 'middle', 'toast-middle', 1_000);
    recordDedupe('r', 'old', 'toast-old-2', 2_000);

    expect(findDedupeHit('r', 'old', 1_000, 2_000)).toBe('toast-old-2');

    // Overflow past the cap. 'middle' is now the oldest insertion, so it is the
    // one that goes even though 'old' was registered first.
    for (let i = 0; i < 499; i += 1) {
      recordDedupe('r', `filler-${i}`, `toast-${i}`, 2_000);
    }

    expect(findDedupeHit('r', 'old', 1_000, 2_000)).toBe('toast-old-2');
    expect(findDedupeHit('r', 'middle', 1_000, 2_000)).toBeNull();
  });
});
