import { act, cleanup, renderHook } from '@testing-library/react-native';
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
 * Wall-clock deadline, in ms from creation, for a toast at `depth` in its
 * position stack.
 *
 * The auto-dismiss budget is
 *
 *   duration + pauseDuration + stagger(depth) - enter - (now - createdAt)
 *
 * so from creation it collapses to `duration + stagger(depth) - enter`. Two
 * deliberate consequences: the enter animation is charged to the motion rather
 * than to the reader's time (a 4000ms toast retires at 3650ms, not 4000ms), and
 * each stack position gets a later deadline so a burst retires progressively
 * instead of all on one frame.
 *
 * Derived from `defaultMotion` rather than written as a literal so that retuning
 * the motion table cannot silently invalidate a whole file of magic numbers.
 */
function deadline(duration: number, depth = 0): number {
  const stagger = Math.min(depth * defaultMotion.stagger, defaultMotion.staggerMax);
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

    // Newest first, and depth assigned as the cap is applied. The array itself is
    // never spliced: the over-cap toast is queued, not deleted, so it can still
    // play an exit if it is evicted later.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['three', 'two']);
    expect(result.current.toasts.map((t) => t.depth)).toEqual([0, 1]);
    expect(result.current.pending.map((t) => t.message)).toEqual(['one']);
  });

  it('caps each position independently', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, maxPending: 10 }));

    act(() => {
      toast('top a');
      toast('top b');
      toast('bottom a', { position: 'bottom-center' });
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['bottom a', 'top b']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['top a']);
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
      toast('queued', { duration: 500 });
      toast('front');
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
      toast('behind it');
      toast('newest');
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['newest']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['behind it']);

    const id = only(result.current.toasts).id;
    act(() => {
      toast.dismiss(id, 'default', 'timeout');
    });

    // Dismissed is not the same as gone. The toast still occupies its slot so
    // React can play the exit, and promotion waits on the removal.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['newest']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['behind it']);
    // Still in the store, not merely in the render: the promotion below is a
    // consequence of the exit finishing and the store shrinking, not of the
    // dismissal flag.
    expect(getState().toasts).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['behind it']);
    expect(result.current.pending).toHaveLength(0);
    // Promotion is a re-slice of the live list, so the promoted toast takes
    // depth 0 and arms a fresh countdown of its own.
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
      toast('behind it');
      toast('newest');
    });

    act(() => {
      toast.remove(only(result.current.toasts).id, 'default');
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['behind it']);
    expect(getState().toasts).toHaveLength(1);
  });

  it('arms a countdown for a queued toast the moment it is promoted', () => {
    const DURATION = 4000;
    // The front toast's exit window. The queued toast spends exactly this long
    // waiting, because promotion cannot happen before the store shrinks.
    const QUEUED_FOR = 400;
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: 400 }),
    );

    act(() => {
      toast('queued', { duration: DURATION });
      toast('front', { duration: 60_000 });
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    const front = only(result.current.toasts);
    act(() => {
      toast.dismiss(front.id, 'default', 'programmatic');
    });
    act(() => {
      jest.advanceTimersByTime(QUEUED_FOR);
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(['queued']);
    // A timer exists now, where none did while it was queued.
    expect(jest.getTimerCount()).toBe(1);

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
    expect(only(result.current.toasts).dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).dismissed).toBe(true);
    expect(only(result.current.toasts).dismissReason).toBe('timeout');
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
      useToaster({ visibleToasts: 1, maxPending: 10, exitDuration: WAITED }),
    );

    act(() => {
      toast('queued', { duration: DURATION });
      toast('front', { duration: 60_000 });
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    const front = only(result.current.toasts);
    act(() => {
      toast.dismiss(front.id, 'default', 'programmatic');
    });

    // Stopped one tick short of the removal, so the promotion can be observed on
    // its own rather than inferred from whatever the next advance happens to do.
    act(() => {
      jest.advanceTimersByTime(WAITED - EPSILON);
    });
    expect(result.current.pending.map((t) => t.message)).toEqual(['queued']);

    // Lands exactly on the tick that promotes it, at t = WAITED.
    act(() => {
      jest.advanceTimersByTime(EPSILON);
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['queued']);
    // The promotion tick is not a retirement tick. Nothing about a long wait may
    // shorten the toast's window: it is up, undismissed, and with no reason yet.
    expect(only(result.current.toasts).dismissed).toBe(false);
    expect(only(result.current.toasts).visible).toBe(true);
    expect(only(result.current.toasts).dismissReason).toBeUndefined();

    // And it then gets its whole duration, measured from here.
    const remaining = deadline(DURATION);
    act(() => {
      jest.advanceTimersByTime(remaining - EPSILON);
    });
    expect(only(result.current.toasts).dismissed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).dismissed).toBe(true);
    expect(only(result.current.toasts).dismissReason).toBe('timeout');
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
    expect(result.current.toasts.map((t) => t.message)).toEqual(['c']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['b', 'a']);
    expect(getState().toasts.every((t) => !t.dismissed)).toBe(true);
  });

  it('marks the victim overflow, and keeps it mounted so its exit can play', () => {
    renderHook(() =>
      useToaster({ visibleToasts: 1, maxPending: 2, dropPolicy: 'oldest' }),
    );

    push('default', ['a', 'b', 'c']);
    push('default', ['d']);

    // The array is newest-first, so 'd' arrived last and is the one the policy
    // sacrifices. It is flagged rather than spliced out — silently vanishing is
    // the upstream bug this replaces.
    const victim = getState().toasts.find((t) => t.message === 'd');
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
    expect(survivors('byOldest')).toEqual(['c', 'b', 'a']);
    expect(survivors('byNewest')).toEqual(['d', 'c', 'b']);
    expect(
      getState('byOldest')
        .toasts.filter((t) => t.dismissReason === 'overflow')
        .map((t) => t.message),
    ).toEqual(['d']);
    expect(
      getState('byNewest')
        .toasts.filter((t) => t.dismissReason === 'overflow')
        .map((t) => t.message),
    ).toEqual(['a']);
  });
});

describe('useToaster — staggered deadlines', () => {
  it('does not retire a stack on one tick; the deeper toast outlives it', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 2, maxPending: 10 }));

    act(() => {
      toast('newest');
      toast('older');
    });

    // Newest-first, so 'older' was pushed second and therefore sits at the front.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['older', 'newest']);
    expect(result.current.toasts.map((t) => t.depth)).toEqual([0, 1]);

    const front = deadline(defaultTimeouts.blank, 0);
    const back = deadline(defaultTimeouts.blank, 1);
    expect(back - front).toBe(defaultMotion.stagger);

    const dismissed = () => result.current.toasts.filter((t) => t.dismissed).map((t) => t.message);

    act(() => {
      jest.advanceTimersByTime(front + EPSILON);
    });
    expect(dismissed()).toEqual(['older']);

    act(() => {
      jest.advanceTimersByTime(back - front);
    });
    expect(dismissed()).toEqual(['older', 'newest']);
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

    // Depth 4 would be 4 * 320 = 1280ms of stagger, well past the 900ms ceiling.
    expect(4 * defaultMotion.stagger).toBeGreaterThan(defaultMotion.staggerMax);
    expect(deadline(defaultTimeouts.blank, 4)).toBe(
      defaultTimeouts.blank + defaultMotion.staggerMax - defaultMotion.enter,
    );
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
