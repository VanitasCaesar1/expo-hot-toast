import { render, screen, act } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';
import { Toaster } from '../src/components/toaster';
import { toast } from '../src/core/toast';
import { __resetStore, reducer, setSettings, ActionType } from '../src/core/store';
import type { ToasterState } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { defaultMotion, durationPresets } from '../src/core/defaults';
import type { Toast } from '../src/core/types';

const EPSILON = 1;

/**
 * Retirement time for a `duration: 'short'` toast at `depth` in its stack.
 *
 * `short` resolves to 2000ms, and the auto-dismiss budget is
 * `duration + stagger(depth) - enter`: the entrance is charged to the motion
 * rather than to the reader, and each stack position gets a later deadline so a
 * burst retires progressively rather than all on one frame.
 */
function deadline(depth = 0): number {
  return (
    durationPresets.short +
    Math.min(depth * defaultMotion.stagger, defaultMotion.staggerMax) -
    defaultMotion.enter
  );
}

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

/**
 * A dismiss *reason* rather than a boolean.
 *
 * `react-native-snackbar` has shipped `DISMISS_EVENT_TIMEOUT` / `_SWIPE` /
 * `_ACTION` / `_MANUAL` / `_CONSECUTIVE` constants since 2016, so the ecosystem
 * already treats the reason as public API. It matters: analytics that cannot
 * distinguish "the user ignored it" from "we evicted it under load" are
 * measuring the wrong thing.
 */
describe('dismiss reasons', () => {
  const empty: ToasterState = {
    toasts: [],
    pausedAt: undefined,
    settings: { visibleToasts: 3, maxPending: 10, dropPolicy: 'oldest' },
  };

  const make = (id: string): Toast => ({
    type: 'blank',
    id,
    message: id,
    pauseDuration: 0,
    // Normally derived by the queue: the anchor the toast resolved to, and its
    // place in that anchor's stack.
    resolvedPosition: 'top-center',
    depth: 0,
    createdAt: Date.now(),
    visible: true,
    dismissed: false,
  });

  /** A region already holding one toast, so DISMISS has something to act on. */
  const holding = (id: string) => ({
    ...empty,
    toasts: [make(id)],
  });

  it('records the reason it was given', () => {
    const state = reducer(holding('x'), {
      type: ActionType.DISMISS_TOAST,
      toastId: 'x',
      reason: 'swipe',
    });

    expect(state.toasts[0]!.dismissReason).toBe('swipe');
  });

  it('defaults to programmatic when no reason is supplied', () => {
    const state = reducer(holding('x'), {
      type: ActionType.DISMISS_TOAST,
      toastId: 'x',
    });
    expect(state.toasts[0]!.dismissReason).toBe('programmatic');
  });

  it('keeps the first reason when a second dismissal arrives', () => {
    // A toast that times out and is then swiped away should report the timeout:
    // that is the cause which explains it, and it is the one worth measuring.
    let state = reducer(holding('x'), {
      type: ActionType.DISMISS_TOAST,
      toastId: 'x',
      reason: 'timeout',
    });
    state = reducer(state, {
      type: ActionType.DISMISS_TOAST,
      toastId: 'x',
      reason: 'swipe',
    });

    expect(state.toasts[0]!.dismissReason).toBe('timeout');
  });

  it('marks a toast pushed out by the buffer as overflow, not programmatic', () => {
    // Capacity is visibleToasts + maxPending, so the third toast is the first one
    // the drop policy has any say about.
    let state: ToasterState = {
      ...empty,
      settings: { ...empty.settings, visibleToasts: 1, maxPending: 1 },
    };
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('a') });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('b') });
    expect(state.toasts.every((t) => !t.dismissed)).toBe(true);

    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('c') });

    // The store array is newest-first, so 'c' arrived last and is the one the
    // policy sacrifices. It stays in the array so its exit can still play.
    const evicted = state.toasts.find((t) => t.id === 'c');
    expect(evicted!.dismissed).toBe(true);
    expect(evicted!.dismissReason).toBe('overflow');
    expect(state.toasts).toHaveLength(3);
    expect(state.toasts.find((t) => t.id === 'a')!.dismissed).toBe(false);
  });

  it('leaves everything alone while the queue is within capacity', () => {
    let state: ToasterState = {
      ...empty,
      settings: { ...empty.settings, visibleToasts: 1, maxPending: 2 },
    };
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('a') });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('b') });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: make('c') });

    // One visible, two queued, nothing dropped: the cap is soft.
    expect(state.toasts.every((t) => t.visible && !t.dismissed)).toBe(true);
  });
});

describe('onDismiss callback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires once, with the timeout reason, after the exit has played', () => {
    const onDismiss = jest.fn();

    render(<Toaster />);
    act(() => {
      toast('watched', { duration: 'short', onDismiss });
    });

    // Dismissed but not yet removed. `short` is 2000ms, and the deadline is that
    // less the 350ms entrance the motion is charged for.
    act(() => {
      jest.advanceTimersByTime(deadline() + EPSILON);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    // Removal effect schedules the callback on the next flush.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 10);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(expect.any(String), 'timeout');
  });

  it('fires exactly once however many times the toast is dismissed', () => {
    const onDismiss = jest.fn();

    render(<Toaster />);
    let id = '';
    act(() => {
      id = toast('twice', { duration: 60_000, onDismiss });
    });

    act(() => {
      toast.dismiss(id, 'default', 'timeout');
      toast.dismiss(id, 'default', 'swipe');
      toast.dismissAll();
    });
    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 10);
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    // The callback hangs off the removal, which happens once, and the first
    // reason is the one kept — so consumers never have to de-duplicate.
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(id, 'timeout');
  });

  it('reports overflow when the pending buffer is overrun', () => {
    const onDismiss = jest.fn();

    // visibleToasts 1 + maxPending 0 leaves no buffer at all, so the second
    // toast is evicted the moment it arrives.
    setSettings({ visibleToasts: 1, maxPending: 0 });

    render(<Toaster />);
    act(() => {
      toast('kept', { duration: 60_000 });
      toast('victim', { duration: 60_000, onDismiss });
    });
    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 10);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(expect.any(String), 'overflow');
  });

  it('reports programmatic dismissal distinctly from a timeout', () => {
    const onDismiss = jest.fn();

    render(<Toaster />);
    act(() => {
      toast('manual', { duration: 60_000, onDismiss });
    });
    act(() => {
      toast.dismissAll(undefined, 'programmatic');
    });
    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 10);
    });

    expect(onDismiss).toHaveBeenCalledWith(expect.any(String), 'programmatic');
  });
});

/**
 * The flag was previously computed at the call site and then discarded by
 * `announce()`, so nothing anywhere honoured it.
 */
describe('assertive announcements', () => {
  it('uses an assertive live region for errors', () => {
    render(<Toaster />);
    act(() => {
      toast.error('went wrong');
    });

    expect(screen.getByLabelText('went wrong').props.accessibilityLiveRegion).toBe(
      'assertive',
    );
  });

  it('uses a polite live region for ordinary toasts', () => {
    render(<Toaster />);
    act(() => {
      toast('all good');
    });

    expect(screen.getByLabelText('all good').props.accessibilityLiveRegion).toBe(
      'polite',
    );
  });

  it('lets an ordinary toast opt into assertive', () => {
    render(<Toaster />);
    act(() => {
      toast('urgent but not an error', { important: true });
    });

    expect(
      screen.getByLabelText('urgent but not an error').props.accessibilityLiveRegion,
    ).toBe('assertive');
  });

  it('lets an error opt back down to polite', () => {
    render(<Toaster />);
    act(() => {
      toast.error('background noise', { important: false });
    });

    expect(
      screen.getByLabelText('background noise').props.accessibilityLiveRegion,
    ).toBe('polite');
  });

  it('announces on iOS via the imperative path', () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

    render(<Toaster />);
    act(() => {
      toast('read me');
    });

    expect(spy).toHaveBeenCalledWith('read me');
    spy.mockRestore();
  });
});
