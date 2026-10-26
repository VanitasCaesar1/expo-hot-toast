import { act, cleanup, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { defaultMotion, defaultTimeouts, durationPresets } from '../src/core/defaults';
import { __resetIdCounter } from '../src/core/ids';
import { __resetStore, getState, setSettings } from '../src/core/store';
import { toast } from '../src/core/toast';
import type { Toast } from '../src/core/types';
import { useToaster, useToasterCleanup } from '../src/core/use-toaster';

/**
 * A gap wide enough that `duration` is strictly exceeded rather than exactly
 * hit. Rounding the other way would let a 1ms scheduling slip turn a
 * "still visible" assertion into a flake.
 */
const EPSILON = 1;

/**
 * Wall-clock deadline, in ms from creation, for the toast shown `order`th
 * among toasts that would otherwise retire together.
 *
 * The auto-dismiss budget is
 *
 *   duration + pauseDuration + stagger - enter - (now - createdAt)
 *
 * so from creation it collapses to `duration + stagger - enter`. Two
 * deliberate consequences: the enter animation is charged to the motion rather
 * than to the reader's time (a 4000ms toast retires at 3650ms, not 4000ms), and
 * toasts shown together get later deadlines in the order they were shown, so a
 * burst retires progressively instead of all on one frame.
 *
 * Derived from `defaultMotion` rather than written as a literal so that retuning
 * the motion table cannot silently invalidate a whole file of magic numbers.
 */
function deadline(duration: number, order = 0): number {
  const stagger = Math.min(order * defaultMotion.stagger, defaultMotion.staggerMax);
  return duration + stagger - defaultMotion.enter;
}

beforeEach(() => {
  jest.useFakeTimers();
  __resetStore();
  __resetIdCounter();
});

afterEach(() => {
  // Unmount first, while the store and the fake clock are still in place. That
  // is the order a real app tears a Toaster down in, and it is the only order
  // in which the unmount assertions below mean anything.
  cleanup();
  __resetStore();
  jest.useRealTimers();
});

describe('useToaster — queue contents', () => {
  it('returns an empty list initially', () => {
    const { result } = renderHook(() => useToaster());
    expect(result.current.toasts).toEqual([]);
  });

  it('reports a dispatched toast in its own region', () => {
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('hello');
    });

    expect(only(result.current.toasts).message).toBe('hello');
    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);
  });

  it('scopes toasts to the toasterId it was mounted for', () => {
    const main = renderHook(() => useToaster({ toasterId: 'main' }));
    const sidebar = renderHook(() => useToaster({ toasterId: 'sidebar' }));

    act(() => {
      toast('for main', { toasterId: 'main' });
    });

    expect(only(main.result.current.toasts).message).toBe('for main');
    expect(sidebar.result.current.toasts).toEqual([]);
    expect(getState('sidebar').toasts).toEqual([]);
    // The default region is untouched by a targeted dispatch.
    expect(getState().toasts).toEqual([]);
  });

  it('keeps two mounted regions from seeing each other\'s toasts', () => {
    const main = renderHook(() => useToaster({ toasterId: 'main' }));
    const sidebar = renderHook(() => useToaster({ toasterId: 'sidebar' }));

    act(() => {
      toast('a', { toasterId: 'main' });
      toast('b', { toasterId: 'sidebar' });
    });

    expect(main.result.current.toasts.map((t) => t.message)).toEqual(['a']);
    expect(sidebar.result.current.toasts.map((t) => t.message)).toEqual(['b']);
  });
});

describe('useToaster — auto-dismiss timers', () => {
  it('auto-dismisses once the type default duration has elapsed', () => {
    const duration = defaultTimeouts.blank;
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('transient');
    });

    // 4000 - 350: the entrance is charged to the motion, not to the reader, so a
    // blank toast is on screen for 4000ms but readable for 3650ms of it.
    const ms = deadline(duration);
    act(() => {
      jest.advanceTimersByTime(ms - EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(false);
    expect(only(result.current.toasts).dismissed).toBe(true);
  });

  it('honours a per-toast duration over the type default', () => {
    const OVERRIDE = 1000;
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('brief', { duration: OVERRIDE });
    });

    expect(only(result.current.toasts).duration).toBe(OVERRIDE);
    expect(OVERRIDE).not.toBe(defaultTimeouts.blank);

    // Past the override's deadline, and long short of the 4000ms blank default
    // the toast would have inherited had the option been dropped.
    act(() => {
      jest.advanceTimersByTime(deadline(OVERRIDE) - EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(false);
    expect(only(result.current.toasts).dismissed).toBe(true);
  });

  it('never auto-dismisses a loading toast, however long it waits', () => {
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast.loading('working…');
    });

    // A loading toast lives until something replaces it, so Infinity has to
    // exclude it from the timer effect outright rather than arming a timer far
    // enough out to be "practically never".
    expect(only(result.current.toasts).duration).toBe(Infinity);

    act(() => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
    });

    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);
  });

  it("resolves 'short' and 'long' to their own deadlines", () => {
    // Behavioural half of the symbolic-duration contract; the resolution table
    // itself is unit-tested in durations.test.ts. Separate regions so each toast
    // sits at depth 0 and the only variable is the preset.
    const SHORT = 'preset-short';
    const LONG = 'preset-long';
    const short = renderHook(() => useToaster({ toasterId: SHORT }));
    const long = renderHook(() => useToaster({ toasterId: LONG }));

    act(() => {
      toast('brief', { toasterId: SHORT, duration: 'short' });
      toast('longer', { toasterId: LONG, duration: 'long' });
    });

    expect(only(short.result.current.toasts).duration).toBe(durationPresets.short);
    expect(only(long.result.current.toasts).duration).toBe(durationPresets.long);

    // Past the short deadline, short of the long one: the pair has to separate,
    // otherwise the two presets are indistinguishable in practice.
    const split = deadline(durationPresets.short) + EPSILON;
    act(() => {
      jest.advanceTimersByTime(split);
    });
    expect(only(short.result.current.toasts).dismissed).toBe(true);
    expect(only(long.result.current.toasts).dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(deadline(durationPresets.long) - split + EPSILON);
    });
    expect(only(long.result.current.toasts).dismissed).toBe(true);
  });

  it("never auto-dismisses a toast with duration: 'infinite'", () => {
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('stays put', { duration: 'infinite' });
    });

    expect(only(result.current.toasts).duration).toBe(Infinity);
    // No timer at all: arming one 10^9 ms out would be "practically never" in
    // name only, and a paused region would still be counting.
    expect(jest.getTimerCount()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);
  });

  it('runs one timer per live toast and clears them all on unmount', () => {
    const { unmount } = renderHook(() => useToaster());

    act(() => {
      toast('one');
      toast('two');
    });

    expect(jest.getTimerCount()).toBe(2);

    unmount();

    // A pending dismissal firing into a detached Toaster is exactly the leak
    // useToasterCleanup exists to prevent.
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('useToaster — pausing', () => {
  it('freezes the countdown between startPause and endPause', () => {
    const DURATION = 2000;
    // 500ms of genuinely un-paused time elapses first, so the resume below can
    // be checked against the remaining budget rather than the whole duration.
    const ELAPSED = 500;
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('pausing', { duration: DURATION });
    });

    act(() => {
      jest.advanceTimersByTime(ELAPSED);
    });

    act(() => {
      result.current.startPause();
    });

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    // Ten seconds of wall-clock past a 2000ms duration, and still standing.
    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);

    act(() => {
      result.current.endPause();
    });

    // The paused span is only banked on resume: START_PAUSE records the instant,
    // END_PAUSE is what credits it to every toast's pauseDuration.
    expect(only(result.current.toasts).pauseDuration).toBe(10_000);

    // The resumed budget is the same one the toast started with, minus the 500ms
    // that really elapsed before the pause began.
    const remaining = deadline(DURATION) - ELAPSED;
    act(() => {
      jest.advanceTimersByTime(remaining - EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(false);
    expect(only(result.current.toasts).dismissed).toBe(true);
  });

  it('leaves no timer armed while paused', () => {
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('frozen', { duration: 2000 });
    });
    expect(jest.getTimerCount()).toBe(1);

    act(() => {
      result.current.startPause();
    });

    // The countdown is wall-clock arithmetic, so pausing has to tear the timer
    // down rather than leave it armed against a frozen clock.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('pauses through the paused option without startPause being called', () => {
    const DURATION = 1000;
    const { result, rerender } = renderHook(
      ({ paused }: { paused: boolean }) => useToaster({ paused }),
      { initialProps: { paused: true } },
    );

    act(() => {
      toast('frozen', { duration: DURATION });
    });

    act(() => {
      jest.advanceTimersByTime(50_000);
    });
    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissed).toBe(false);

    rerender({ paused: false });

    // Resuming gives back the whole budget, not the 50s that passed while the
    // option held the region frozen.
    act(() => {
      jest.advanceTimersByTime(deadline(DURATION) - EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(false);
    expect(only(result.current.toasts).dismissed).toBe(true);
  });

  it('exposes startPause and endPause again under handlers, as react-hot-toast does', () => {
    const { result } = renderHook(() => useToaster());

    expect(result.current.handlers.startPause).toBe(result.current.startPause);
    expect(result.current.handlers.endPause).toBe(result.current.endPause);

    act(() => {
      result.current.handlers.startPause();
    });
    expect(getState().pausedAt).toBeDefined();
    act(() => {
      result.current.handlers.endPause();
    });
    expect(getState().pausedAt).toBeUndefined();
  });

  it('ignores endPause when the region was never paused', () => {
    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('unpaused', { duration: 1000 });
    });

    // Without this guard END_PAUSE would credit every toast with the entire
    // epoch as pauseDuration and the toast would never expire.
    act(() => {
      result.current.endPause();
    });

    expect(only(result.current.toasts).pauseDuration).toBe(0);

    act(() => {
      jest.advanceTimersByTime(deadline(1000) + EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(false);
  });
});

describe('useToaster — visible cap', () => {
  it('writes visibleToasts into the region settings on mount', () => {
    renderHook(() => useToaster({ visibleToasts: 3 }));
    expect(getState().settings.visibleToasts).toBe(3);
  });

  it('scopes the cap to the region that declared it', () => {
    renderHook(() => useToaster({ toasterId: 'main', visibleToasts: 4 }));
    expect(getState('main').settings.visibleToasts).toBe(4);
    // The default region keeps its own default — three, not react-hot-toast's 20.
    expect(getState().settings.visibleToasts).toBe(3);
  });

  it('leaves an already-configured cap alone when no option is given', () => {
    // Omitting visibleToasts must be a no-op, not a reset back to the default —
    // otherwise a second Toaster mount would silently undo the first's setting.
    setSettings({ visibleToasts: 7 });

    renderHook(() => useToaster());

    expect(getState().settings.visibleToasts).toBe(7);
  });

  it('still accepts toastLimit as a deprecated alias', () => {
    // Kept working because it shipped in 0.0.x; it just writes the number the
    // new option names, so nothing reads it as a hard cap any more.
    renderHook(() => useToaster({ toastLimit: 2 }));
    expect(getState().settings.visibleToasts).toBe(2);
  });

  it('renders visibleToasts per position and hands the rest to pending', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 2, maxPending: 10 }));

    act(() => {
      toast('one');
      toast('two');
      toast('three');
    });

    // First come, first shown: the first two take the places, drawn newest
    // first, and the third waits its turn. The array itself is never spliced:
    // the over-cap toast is queued, not deleted, so it can still play an exit
    // if it is evicted later.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['two', 'one']);
    expect(result.current.toasts.map((t) => t.depth)).toEqual([0, 1]);
    expect(result.current.pending.map((t) => t.message)).toEqual(['three']);
  });

  it('caps each position independently', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, maxPending: 10 }));

    act(() => {
      toast('top a');
      toast('top b');
      toast('bottom a', { position: 'bottom-center' });
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['bottom a', 'top a']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['top b']);
  });

  it('fills two positions to the default cap of three with nothing left over', () => {
    // The cap is per position, not per region: a full bottom stack and a full top
    // stack are six on-screen toasts, and neither end has to wait for the other to
    // retire. This is the case a single shared counter gets wrong.
    expect(getState().settings.visibleToasts).toBe(3);

    const { result } = renderHook(() => useToaster());

    act(() => {
      toast('top a');
      toast('top b');
      toast('top c');
      toast('bottom a', { position: 'bottom-center' });
      toast('bottom b', { position: 'bottom-center' });
      toast('bottom c', { position: 'bottom-center' });
    });

    expect(result.current.pending).toEqual([]);

    const at = (position: string) =>
      result.current.toasts.filter((t) => t.resolvedPosition === position);

    expect(at('top-center').map((t) => t.message).sort()).toEqual(['top a', 'top b', 'top c']);
    expect(at('bottom-center').map((t) => t.message).sort()).toEqual([
      'bottom a',
      'bottom b',
      'bottom c',
    ]);
    // Depth restarts per position, so the stagger — and the ordering that reads
    // as "newest nearest the edge" — is computed against the toast's own stack.
    expect(at('top-center').map((t) => t.depth).sort()).toEqual([0, 1, 2]);
    expect(at('bottom-center').map((t) => t.depth).sort()).toEqual([0, 1, 2]);
  });
});

describe('useToaster — pending buffer', () => {
  it('arms no timer for a pending toast, so it cannot expire unseen', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, maxPending: 10 }));

    act(() => {
      toast('front');
      toast('queued', { duration: 500 });
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['front']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);
    // One timer, not two: the countdown belongs to the toast being read.
    expect(jest.getTimerCount()).toBe(1);

    // 500 - 350 is the deadline the queued toast *would* have had if it were
    // armed. It is still queued, still undismissed.
    act(() => {
      jest.advanceTimersByTime(deadline(500) + EPSILON);
    });

    expect(only(result.current.pending).dismissed).toBe(false);
    expect(result.current.toasts.map((t) => t.message)).toEqual(['front']);
  });

  it('promotes the next pending toast once the visible one is removed', () => {
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: 400 }),
    );

    act(() => {
      toast('first');
      toast('behind it');
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['first']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['behind it']);

    const id = only(result.current.toasts).id;
    act(() => {
      toast.dismiss(id, 'default', 'timeout');
    });

    // A leaving toast gives up its slot at once: the next one moves up while
    // the dismissed one is still drawn, playing its exit in place. Waiting for
    // the exit left the slot empty, and a burst could empty every slot.
    expect(result.current.toasts.map((t) => [t.message, t.dismissed])).toEqual([
      ['behind it', false],
      ['first', true],
    ]);
    expect(result.current.pending).toHaveLength(0);
    expect(getState().toasts).toHaveLength(2);
    // Its removal, and the promoted toast's own countdown.
    expect(jest.getTimerCount()).toBe(2);

    act(() => {
      jest.advanceTimersByTime(400);
    });

    // Removed, so the promoted toast is the front of the stack.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['behind it']);
    expect(only(result.current.toasts).depth).toBe(0);
    expect(jest.getTimerCount()).toBe(1);
  });

  it('promotes on an instant removal as well as after an exit delay', () => {
    // `remove` skips the exit entirely. Promotion has to follow the store
    // shrinking, not the exit, so both removal paths free the slot.
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: 400 }),
    );

    act(() => {
      toast('first');
      toast('behind it');
    });

    act(() => {
      toast.remove(only(result.current.toasts).id, 'default');
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['behind it']);
    expect(getState().toasts).toHaveLength(1);
  });

  it('arms a countdown for a queued toast the moment it is promoted', () => {
    const DURATION = 4000;
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: 400 }),
    );

    act(() => {
      toast('front', { duration: 60_000 });
      toast('queued', { duration: DURATION });
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    const front = only(result.current.toasts);
    act(() => {
      toast.dismiss(front.id, 'default', 'programmatic');
    });

    // Promoted the moment the front toast is dismissed.
    const queued = () => result.current.toasts.find((t) => t.message === 'queued')!;
    expect(queued().dismissed).toBe(false);
    // Its countdown, beside the front toast's removal; none while it waited.
    expect(jest.getTimerCount()).toBe(2);

    // The countdown is the toast's *full* deadline, run from the promotion rather
    // than from creation. The time it spent queued is time it was not on screen,
    // so charging it against the budget would make the wait invisible to the
    // reader while still eating the toast's only readable window — and, worse,
    // would make the deadline a function of how long the region happened to be
    // busy rather than of anything the user can see or control.
    const remaining = deadline(DURATION);
    act(() => {
      jest.advanceTimersByTime(remaining - EPSILON);
    });
    expect(queued().dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(queued().dismissed).toBe(true);
    expect(queued().dismissReason).toBe('timeout');
  });

  it('gives a promoted toast a full duration even after it waited longer than that duration', () => {
    // The point of tracking `visibleSince`: a toast's timer runs from when it was
    // *seen*, not from when it was created. The wait here is deliberately longer
    // than the toast's own duration, which is exactly the case that breaks a
    // creation-anchored budget — it leaves nothing to spend, so the toast would be
    // retired on the promotion tick, appearing and vanishing before anyone could
    // read it. Queuing is the library's job, not something the reader is charged
    // for.
    const DURATION = 2000;
    const WAITED = 5000;
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: 400 }),
    );

    act(() => {
      toast('front', { duration: 60_000 });
      toast('queued', { duration: DURATION });
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    // The front toast stays up longer than the queued toast's whole duration.
    act(() => {
      jest.advanceTimersByTime(WAITED);
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    const front = result.current.toasts.find((t) => t.message === 'front')!;
    act(() => {
      toast.dismiss(front.id, 'default', 'programmatic');
    });
    const queued = () => result.current.toasts.find((t) => t.message === 'queued')!;
    // The promotion tick is not a retirement tick. Nothing about a long wait may
    // shorten the toast's window: it is up, undismissed, and with no reason yet.
    expect(queued().dismissed).toBe(false);
    expect(queued().visible).toBe(true);
    expect(queued().dismissReason).toBeUndefined();

    // And it then gets its whole duration, measured from here.
    const remaining = deadline(DURATION);
    act(() => {
      jest.advanceTimersByTime(remaining - EPSILON);
    });
    expect(queued().dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(queued().dismissed).toBe(true);
    expect(queued().dismissReason).toBe('timeout');
  });
});

describe('useToaster — bursts', () => {
  it('plays a burst in the order it was fired: the first ones show, the rest wait', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 3, maxPending: 10, exitDuration: 400 }));
    act(() => {
      for (let n = 1; n <= 5; n++) toast(`Item ${n}`, { duration: 60_000 });
    });
    // Drawn newest first, nearest the edge; nothing pushed off to come back.
    expect(result.current.toasts.map((t) => [t.message, !!t.queued])).toEqual([
      ['Item 3', false],
      ['Item 2', false],
      ['Item 1', false],
    ]);
    expect(result.current.pending.map((t) => t.message)).toEqual(['Item 5', 'Item 4']);

    // The first to arrive leaves first, and the next in line takes its place.
    act(() => toast.dismiss(result.current.toasts.find((t) => t.message === 'Item 1')!.id));
    expect(result.current.toasts.filter((t) => !t.dismissed).map((t) => t.message)).toEqual(['Item 4', 'Item 3', 'Item 2']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['Item 5']);
  });

  it('lets an error go ahead of the queue; the newest showing waits for it, with an exit', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 2, maxPending: 10, exitDuration: 400 }));
    act(() => {
      toast('first', { duration: 60_000 });
      toast('second', { duration: 60_000 });
      toast('waiting', { duration: 60_000 });
    });
    act(() => {
      toast.error('Payment failed', { duration: 60_000 });
    });

    // Still drawn, flagged queued, so a renderer plays its exit.
    expect(result.current.toasts.map((t) => [t.message, !!t.queued])).toEqual([
      ['Payment failed', false],
      ['second', true],
      ['first', false],
    ]);
    expect(result.current.pending.map((t) => t.message)).toEqual(['waiting', 'second']);

    act(() => {
      jest.advanceTimersByTime(450);
    });
    // Its exit is over: it waits off screen, its timer paused, ahead of the
    // toast that arrived after it.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['Payment failed', 'first']);
    act(() => toast.dismiss(result.current.toasts[0]!.id));
    expect(result.current.toasts.filter((t) => !t.dismissed).map((t) => t.message)).toEqual(['second', 'first']);
  });

  it('lets an important toast go ahead of the queue too', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, maxPending: 10 }));
    act(() => {
      toast('first', { duration: 60_000 });
      toast('Card expires tomorrow', { important: true, duration: 60_000 });
    });
    expect(result.current.toasts.filter((t) => !t.queued).map((t) => t.message)).toEqual(['Card expires tomorrow']);
  });

  it('never fills the slots with leaving toasts in a burst that overflows the queue', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 3, maxPending: 10, exitDuration: 400 }));
    act(() => {
      for (let n = 0; n < 18; n++) toast(`t${n}`, { duration: 60_000 });
    });
    const live = result.current.toasts.filter((t) => !t.dismissed && !t.queued);
    // The oldest were dropped, not the new ones, and the next in line show.
    expect(live.map((t) => t.message)).toEqual(['t7', 't6', 't5']);
    expect(getState().toasts.filter((t) => t.dismissReason === 'overflow').map((t) => t.message)).toEqual(
      ['t4', 't3', 't2', 't1', 't0'],
    );
    // Dropped toasts that were never shown are not drawn at all.
    expect(result.current.toasts.some((t) => t.dismissReason === 'overflow')).toBe(false);
  });
});

describe('useToaster — overflow', () => {
  /**
   * Pushes `messages` into a region in one act. The store array is newest-first,
   * so the last message pushed ends up at index 0 — the front of the stack.
   */
  const push = (region: string, messages: string[]) =>
    act(() => {
      messages.forEach((message) => {
        toast(message, { toasterId: region, duration: 60_000 });
      });
    });

  it('evicts nothing until visibleToasts + maxPending is exceeded', () => {
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 2, dropPolicy: 'oldest' }),
    );

    push('default', ['a', 'b', 'c']);

    // Capacity is 1 + 2 = 3, so nothing has been dropped yet: 1 visible, 2 queued.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['a']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['c', 'b']);
    expect(getState().toasts.every((t) => !t.dismissed)).toBe(true);
  });

  it('marks the victim overflow, and keeps it mounted so its exit can play', () => {
    renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 2, dropPolicy: 'oldest' }),
    );

    push('default', ['a', 'b', 'c']);
    push('default', ['d']);

    // 'oldest' sacrifices 'a', the first to arrive, which has been on screen.
    // It is flagged rather than spliced out — silently vanishing is the
    // upstream bug this replaces.
    const victim = getState().toasts.find((t) => t.message === 'a');
    expect(victim!.dismissed).toBe(true);
    expect(victim!.dismissReason).toBe('overflow');
    expect(getState().toasts).toHaveLength(4);
  });

  it("dropPolicy: 'newest' evicts from the opposite end to 'oldest'", () => {
    renderHook(() =>
      useToaster({ toasterId: 'byOldest', visibleToasts: 1, maxPending: 2, dropPolicy: 'oldest' }),
    );
    renderHook(() =>
      useToaster({ toasterId: 'byNewest', visibleToasts: 1, maxPending: 2, dropPolicy: 'newest' }),
    );

    push('byOldest', ['a', 'b', 'c', 'd']);
    push('byNewest', ['a', 'b', 'c', 'd']);

    const survivors = (region: string) =>
      getState(region)
        .toasts.filter((t) => !t.dismissed)
        .map((t) => t.message);

    // One toast over capacity in each region; the policy decides which end pays.
    expect(survivors('byOldest')).toEqual(['d', 'c', 'b']);
    expect(survivors('byNewest')).toEqual(['c', 'b', 'a']);
    expect(
      getState('byOldest')
        .toasts.filter((t) => t.dismissReason === 'overflow')
        .map((t) => t.message),
    ).toEqual(['a']);
    expect(
      getState('byNewest')
        .toasts.filter((t) => t.dismissReason === 'overflow')
        .map((t) => t.message),
    ).toEqual(['d']);
  });
});

describe('useToaster — staggered deadlines', () => {
  it('does not retire a stack on one tick; the first shown leaves first', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 2, maxPending: 10 }));

    act(() => {
      toast('first');
      toast('second');
    });

    // Newest-first, so 'second' sits at the front.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['second', 'first']);
    expect(result.current.toasts.map((t) => t.depth)).toEqual([0, 1]);

    const earlier = deadline(defaultTimeouts.blank, 0);
    const later = deadline(defaultTimeouts.blank, 1);
    expect(later - earlier).toBe(defaultMotion.stagger);

    const dismissed = () => result.current.toasts.filter((t) => t.dismissed).map((t) => t.message);

    act(() => {
      jest.advanceTimersByTime(earlier + EPSILON);
    });
    expect(dismissed()).toEqual(['first']);

    act(() => {
      jest.advanceTimersByTime(later - earlier);
    });
    expect(dismissed()).toEqual(['second', 'first']);
  });

  it('staggers only toasts that would retire together', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 2, maxPending: 10 }));
    act(() => {
      toast('long', { duration: 6000 });
      toast('short', { duration: 2000 });
    });
    // Four seconds apart already: the short one keeps its own time.
    act(() => {
      jest.advanceTimersByTime(deadline(2000) + EPSILON);
    });
    expect(result.current.toasts.find((t) => t.message === 'short')!.dismissed).toBe(true);
  });

  it('caps the stagger so a deep stack cannot hold a toast for minutes', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 5, maxPending: 10 }));

    act(() => {
      toast('a');
      toast('b');
      toast('c');
      toast('d');
      toast('e');
    });

    expect(result.current.toasts.map((t) => t.depth)).toEqual([0, 1, 2, 3, 4]);

    // The fifth would be 4 * 320 = 1280ms late, well past the 900ms ceiling.
    expect(4 * defaultMotion.stagger).toBeGreaterThan(defaultMotion.staggerMax);
    act(() => {
      jest.advanceTimersByTime(defaultTimeouts.blank + defaultMotion.staggerMax - defaultMotion.enter + EPSILON);
    });
    expect(result.current.toasts.every((t) => t.dismissed)).toBe(true);
  });
});

describe('useToasterCleanup', () => {
  it("clears the region's state and its timers on unmount", () => {
    const { unmount } = renderHook(() => {
      useToaster({ toasterId: 'temporary' });
      useToasterCleanup({ toasterId: 'temporary' });
    });

    act(() => {
      toast('ephemeral', { toasterId: 'temporary' });
    });
    expect(getState('temporary').toasts).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(1);

    unmount();

    expect(getState('temporary').toasts).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the region when destroyOnUnmount is false', () => {
    const { unmount } = renderHook(() => {
      useToaster({ toasterId: 'persistent' });
      useToasterCleanup({ toasterId: 'persistent', destroyOnUnmount: false });
    });

    act(() => {
      toast('kept', { toasterId: 'persistent' });
    });

    unmount();

    expect(getState('persistent').toasts).toHaveLength(1);
  });

  it('does not let one region\'s unmount touch another', () => {
    const temporary = renderHook(() => {
      useToaster({ toasterId: 'temporary' });
      useToasterCleanup({ toasterId: 'temporary' });
    });
    renderHook(() => useToaster({ toasterId: 'permanent' }));

    act(() => {
      toast('gone', { toasterId: 'temporary' });
      toast('stays', { toasterId: 'permanent' });
    });

    temporary.unmount();

    expect(getState('temporary').toasts).toEqual([]);
    expect(only(getState('permanent').toasts).message).toBe('stays');
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Narrow a region to its single toast, failing loudly if that is not so. */
function only(toasts: Toast[]): Toast {
  expect(toasts).toHaveLength(1);
  return toasts[0]!;
}

/**
 * Regression test for a bug found by running the library on an iOS 26
 * simulator, not by any unit test.
 *
 * Reanimated's `exiting` only plays when React unmounts the component — it
 * cannot remove anything from the store. Nothing was ever unmounting them, so
 * every expired toast played its exit and then sat there forever at the exit
 * transform: dead, still on screen, still occupying a toastLimit slot. The
 * screen filled up with stale panels one expiry at a time.
 */
describe('useToaster — dismissed toasts are eventually removed', () => {
  beforeEach(() => {
    __resetStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('removes a toast once its exit animation has had time to finish', () => {
    const { result } = renderHook(() =>
      useToaster({ exitDuration: 400 }),
    );

    act(() => {
      toast('will expire');
    });
    expect(result.current.toasts).toHaveLength(1);

    // Past the blank default's deadline: dismissed, but still mounted so the
    // exit can play.
    act(() => {
      jest.advanceTimersByTime(deadline(defaultTimeouts.blank) + EPSILON);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.dismissed).toBe(true);

    // Past the exit duration: now it must actually be gone.
    act(() => {
      jest.advanceTimersByTime(401);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes an explicitly dismissed toast too', () => {
    const { result } = renderHook(() => useToaster({ exitDuration: 400 }));

    act(() => {
      toast('manual');
    });
    act(() => {
      toast.dismissAll();
    });
    act(() => {
      jest.advanceTimersByTime(401);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes after the toast\'s own removeDelay instead of the exit duration', () => {
    const { result } = renderHook(() => useToaster({ exitDuration: 400 }));

    act(() => {
      toast('quick', { id: 'quick', removeDelay: 100 });
      toast('slow', { id: 'slow', removeDelay: 1000 });
    });
    act(() => {
      toast.dismissAll();
    });

    act(() => {
      jest.advanceTimersByTime(101);
    });
    expect(result.current.toasts.map((t) => t.id)).toEqual(['slow']);

    // Past the exit duration, but not past the toast's own delay.
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.toasts.map((t) => t.id)).toEqual(['slow']);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('takes removeDelay from toastOptions, per-type bucket first', () => {
    const { result } = renderHook(() =>
      useToaster({
        exitDuration: 400,
        toastOptions: { removeDelay: 1000, error: { removeDelay: 50 } },
      }),
    );

    act(() => {
      toast.error('bucket', { id: 'bucket' });
      toast('global', { id: 'global' });
    });
    act(() => {
      toast.dismissAll();
    });
    act(() => {
      jest.advanceTimersByTime(51);
    });

    expect(result.current.toasts.map((t) => t.id)).toEqual(['global']);
  });

  it('does not remove a toast that is revived during its exit', () => {
    // The toast.promise loading -> success swap upserts onto the same id while
    // the loading toast's removal is pending. Without cancelling, the live toast
    // would be yanked off screen the moment the timer fired.
    const { result } = renderHook(() => useToaster({ exitDuration: 400 }));

    act(() => {
      toast('loading', { id: 'fixed', duration: Infinity });
    });
    act(() => {
      toast.dismiss('fixed');
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    act(() => {
      toast.success('done', { id: 'fixed' });
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]!.type).toBe('success');
    expect(result.current.toasts[0]!.visible).toBe(true);
  });

  it('does not leave pending timers that outlive unmount', () => {
    const { result, unmount } = renderHook(() => useToaster({ exitDuration: 400 }));

    act(() => {
      toast('pending');
    });
    act(() => {
      toast.dismissAll();
    });

    unmount();

    // Would throw or leak into memoryState after the region is gone.
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    expect(() => act(() => { jest.advanceTimersByTime(1); })).not.toThrow();
  });
});

describe('useToaster — demotion and re-promotion', () => {
  it('gives a toast pushed back into the queue a fresh budget when it returns', () => {
    // Regression: a visible toast displaced by a newer one kept its original
    // first-visible time, so on promotion its budget was already spent and it
    // was dismissed on the tick it reappeared.
    const { result } = renderHook(() => useToaster({ visibleToasts: 1 }));
    act(() => {
      toast('first', { duration: 3000 });
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => {
      toast.error('second', { duration: 2000 });
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['first']);

    // `second` times out, and `first` is promoted as it starts to leave.
    act(() => {
      jest.advanceTimersByTime(deadline(2000) + EPSILON);
    });
    const first = () => result.current.toasts.find((t) => t.message === 'first')!;
    expect(first().dismissed).toBe(false);
    act(() => {
      jest.advanceTimersByTime(deadline(3000) - EPSILON * 2);
    });
    expect(first().dismissed).toBe(false);
  });
});

describe('useToaster — motion override', () => {
  it('times toasts with the motion it is given', () => {
    const { result } = renderHook(() => useToaster({ motion: { enter: 0 } }));
    act(() => {
      toast('x', { duration: 1000 });
    });

    // With the default 350ms enter this toast would already be gone.
    act(() => {
      jest.advanceTimersByTime(1000 - EPSILON);
    });
    expect(result.current.toasts[0]!.dismissed).toBe(false);
    act(() => {
      jest.advanceTimersByTime(EPSILON * 2);
    });
    expect(result.current.toasts[0]!.dismissed).toBe(true);
  });
});

describe('useToaster — returning from the background', () => {
  /** Captures the AppState listener the hook registers, so a resume can be simulated. */
  function captureAppState() {
    const listeners: Array<(state: string) => void> = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      listener: (state: string) => void,
    ) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    }) as never);
    return {
      resumeAfter(ms: number) {
        act(() => {
          listeners.forEach((l) => l('background'));
          jest.setSystemTime(Date.now() + ms);
          listeners.forEach((l) => l('active'));
        });
      },
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('expires a visible toast whose deadline passed while suspended', () => {
    const app = captureAppState();
    const { result } = renderHook(() => useToaster());
    act(() => {
      toast('stale', { duration: 1000 });
    });

    app.resumeAfter(60_000);

    expect(result.current.toasts[0]!.dismissed).toBe(true);
    expect(result.current.toasts[0]!.dismissReason).toBe('timeout');
  });

  it('keeps a toast through a short trip away, with the time it had left', () => {
    const app = captureAppState();
    const { result } = renderHook(() => useToaster());
    act(() => {
      toast('Saved', { duration: 2000 });
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    // Timers run while away in a real app; the pause must hold them anyway.
    app.resumeAfter(10_000);
    expect(result.current.toasts[0]!.dismissed).toBe(false);
    act(() => {
      jest.advanceTimersByTime(deadline(2000) - 500 - 50);
    });
    expect(result.current.toasts[0]!.dismissed).toBe(false);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current.toasts[0]!.dismissed).toBe(true);
  });

  it('leaves a queued toast alone: it has not been seen yet', () => {
    const app = captureAppState();
    const { result } = renderHook(() => useToaster({ visibleToasts: 1 }));
    act(() => {
      toast('front', { duration: 'infinite' });
      toast('waiting', { duration: 1000 });
    });

    app.resumeAfter(60_000);

    expect(result.current.pending.map((t) => [t.message, t.dismissed])).toEqual([
      ['waiting', false],
    ]);
  });

  it('expires nothing while the region is paused', () => {
    // Regression: paused time is only credited on END_PAUSE, so a resume while
    // paused saw every deadline as long gone and dismissed the lot.
    const app = captureAppState();
    const { result } = renderHook(() => useToaster({ paused: true }));
    act(() => {
      toast('held', { duration: 1000 });
    });

    app.resumeAfter(60_000);

    expect(result.current.toasts[0]!.dismissed).toBe(false);
  });
});

