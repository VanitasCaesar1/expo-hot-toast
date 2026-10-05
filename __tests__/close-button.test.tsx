import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Toaster } from '../src/components/toaster';
import { toast } from '../src/core/toast';
import { __resetStore, getState } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { darkTheme, defaultTheme, useToastTheme } from '../src/theme/tokens';
import { ToastBar } from '../src/components/toast-bar';
import { defaultMotion, durationPresets } from '../src/core/defaults';
import type { Toast } from '../src/core/types';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

const EPSILON = 1;

/**
 * Retirement time for a `duration: 'short'` toast at `depth` in its stack.
 *
 * `short` resolves to 2000ms, and the auto-dismiss budget is
 * `duration + stagger(depth) - enter`: the entrance animation is charged to the
 * motion rather than to the reader, and each stack position gets a later deadline
 * so a burst retires progressively instead of all on one frame.
 */
function deadline(depth = 0): number {
  return (
    durationPresets.short +
    Math.min(depth * defaultMotion.stagger, defaultMotion.staggerMax) -
    defaultMotion.enter
  );
}

/** Toasts in the burst. More than the cap, so the queue is exercised. */
const BURST = 6;
/** `visibleToasts` default. Whatever the store is configured with, the tree holds this. */
const CAP = 3;

/**
 * Clock advanced per drain tick.
 *
 * Small on purpose. A dismissal and the exit window that follows it can only be
 * observed in separate ticks — the removal timer is scheduled by the effect that
 * sees the dismissal, so a coarse tick charges the burst for latency that is an
 * artefact of the harness rather than of the queue.
 */
const DRAIN_TICK = 100;

/**
 * How much clock the burst needs to drain, derived from the motion table.
 *
 * The cap has to empty before the *last* queued toast is promoted, and each
 * promotion then runs a whole duration of its own:
 *
 *   deadline(cap - 1)   the deepest toast of the first wave to be dismissed
 *   + motion.exit       ... and removed, freeing the slot it was holding
 *   + deadline(0)       the last promoted toast's full life
 *   + motion.exit       ... and its own removal
 *
 * plus one tick per step, because a removal is scheduled on the tick that observes
 * the dismissal rather than at the instant the deadline passes. A bound rather
 * than a prediction: the point of the assertion below is that the queue reaches
 * an empty tree at all, not that it takes an exact number of milliseconds.
 */
const drainMs =
  deadline(CAP - 1) + 2 * defaultMotion.exit + deadline(0) + BURST * DRAIN_TICK;

/**
 * Clock at which the first queued toast has been promoted: the front toast's
 * deadline, then the exit that has to finish before its slot is freed, then the
 * next tick on which the resulting removal can be observed.
 */
const promotedAt = deadline(0) + defaultMotion.exit + 2 * DRAIN_TICK;

/**
 * The store's record of one rendered toast. The tree cannot show whether a
 * promoted toast is still alive, because a dismissed toast stays mounted through
 * its exit — so the promotion assertions read here.
 */
function storeFor(message: string): Toast {
  const match = getState().toasts.find((t) => t.message === message);
  if (!match) throw new Error(`no toast in the store reading "${message}"`);
  return match;
}

/**
 * Both of these came from watching the app on a simulator rather than from
 * anything a type checker could catch.
 */
describe('close button', () => {
  it('is absent by default, to match react-hot-toast', () => {
    render(<Toaster />);
    act(() => {
      toast('no button');
    });

    expect(screen.queryByLabelText('Dismiss')).toBeNull();
  });

  it('appears when closeable is set on the Toaster', () => {
    render(<Toaster toastOptions={{ closeable: true }} />);
    act(() => {
      toast('closable');
    });

    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
  });

  it('appears when closeable is set on a single toast', () => {
    render(<Toaster />);
    act(() => {
      toast('plain');
      toast('closable', { closeable: true });
    });

    // One toast opted in, one did not.
    expect(screen.getAllByLabelText('Dismiss')).toHaveLength(1);
  });

  it('dismisses the toast when pressed', () => {
    const onDismiss = jest.fn();
    const toastValue: Toast = {
      type: 'blank',
      id: 'closable-1',
      message: 'tap me',
      pauseDuration: 0,
      // Hand-built rather than store-made, so the two fields the queue normally
      // derives have to be supplied: the resolved anchor, and its place in that
      // anchor's stack.
      resolvedPosition: 'top-center',
      depth: 0,
      createdAt: Date.now(),
      visible: true,
      dismissed: false,
      closeable: true,
    };

    render(
      <ToastBar
        toast={toastValue}
        theme={darkTheme}
        atTop
        reverseOrder={false}
        onDismiss={onDismiss}
        onPressIn={jest.fn()}
        onPressOut={jest.fn()}
        panThreshold={0}
      />,
    );

    fireEvent.press(screen.getByLabelText('Dismiss'));
    // The reason matters as much as the id: it is what distinguishes a close
    // from a timeout or an overflow eviction when reported upstream.
    expect(onDismiss).toHaveBeenCalledWith('closable-1', 'close');
  });

  it('exposes itself as a button to assistive tech', () => {
    render(<Toaster toastOptions={{ closeable: true }} />);
    act(() => {
      toast('a11y');
    });

    expect(screen.getByLabelText('Dismiss').props.accessibilityRole).toBe('button');
  });

  it('honours a per-toast close button colour', () => {
    render(
      <ToastBar
        toast={
          {
            type: 'blank',
            id: 'tinted',
            message: 'tinted',
            pauseDuration: 0,
            resolvedPosition: 'top-center',
            depth: 0,
            createdAt: Date.now(),
            visible: true,
            dismissed: false,
            closeable: true,
            closeButtonColor: '#FF0000',
          } as Toast
        }
        theme={defaultTheme}
        atTop
        reverseOrder={false}
        onDismiss={jest.fn()}
        onPressIn={jest.fn()}
        onPressOut={jest.fn()}
        panThreshold={0}
      />,
    );

    expect(screen.getByLabelText('Dismiss')).toBeTruthy();
  });
});

/**
 * Text contrast was the worst of the three problems: the default theme hardcodes
 * `#1c1c1e` for light backgrounds, and `useColorScheme` reports the OS setting
 * rather than the app's appearance. A forced-dark UI on a light-mode system
 * therefore rendered dark text on dark glass — effectively invisible.
 */
describe('colour scheme', () => {
  it('exposes genuinely different text colours per scheme', () => {
    // If these were the same value the override would be pointless.
    expect(defaultTheme.color).not.toBe(darkTheme.color);
    expect(darkTheme.background).not.toBe(defaultTheme.background);
  });

  it('gives dark text on a light glass and light text on a dark glass', () => {
    const light = { ...defaultTheme };
    const dark = { ...darkTheme };

    // Contrast sanity: light scheme must not pair dark text with a dark
    // background, and dark scheme must not do the reverse.
    expect(light.color).toBe('#1c1c1e');
    expect(dark.color).toBe('#f2f2f7');
  });

  it('forces dark tokens on the Toaster regardless of system setting', () => {
    render(<Toaster colorScheme="dark" />);
    act(() => {
      toast('forced dark');
    });

    // The surface must be the dark fallback, not the light one.
    expect(screen.getByText('forced dark')).toBeTruthy();
  });

  it('accepts the override on the theme hook', () => {
    const light = useToastTheme(undefined, 'light');
    const dark = useToastTheme(undefined, 'dark');

    expect(light.color).toBe(defaultTheme.color);
    expect(dark.color).toBe(darkTheme.color);
  });
});

/**
 * The dismissal bug was only reproducible on a device: expired toasts played
 * their exit and then stayed on screen forever, because nothing ever unmounted
 * them from the store.
 */
describe('auto-dismissal reaches the screen', () => {
  it('clears an expired toast from the tree once its exit has played', () => {
    jest.useFakeTimers();

    render(<Toaster />);
    act(() => {
      toast('expires shortly', { duration: 'short' });
    });
    expect(screen.getByText('expires shortly')).toBeTruthy();

    // Two separate ticks on purpose. The dismissal fires on the first; the
    // removal timer can only be scheduled once React has flushed the effect
    // that observes the dismissal, so it cannot fire in the same advance.
    act(() => {
      jest.advanceTimersByTime(deadline() + EPSILON);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 50);
    });

    expect(screen.queryByText('expires shortly')).toBeNull();
    jest.useRealTimers();
  });

  it('mounts only the visible cap of a burst, then drains to an empty tree', () => {
    jest.useFakeTimers();

    render(<Toaster />);
    act(() => {
      for (let i = 0; i < BURST; i += 1) {
        toast(`burst ${i}`, { duration: 'short' });
      }
    });

    // visibleToasts defaults to 3. The other three are queued rather than
    // mounted, so a burst is no longer a wall of glass.
    expect(screen.getAllByText(/burst /)).toHaveLength(CAP);
    expect(screen.getByText('burst 5')).toBeTruthy();
    expect(screen.queryByText('burst 2')).toBeNull();

    // Drain in ticks until the front toast has retired and the first queued toast
    // has taken its slot.
    for (let elapsed = 0; elapsed < promotedAt; elapsed += DRAIN_TICK) {
      act(() => {
        jest.advanceTimersByTime(DRAIN_TICK);
      });
    }

    // The promotion itself is the point worth asserting: a queued toast arrives on
    // screen *alive*. It cannot be told apart from a retired one by looking at the
    // tree — a dismissed toast stays mounted so its exit can play — so the
    // assertion reads the store, where a promotion that expired on its own tick
    // would show up as `dismissed`.
    expect(screen.getByText('burst 2')).toBeTruthy();
    expect(storeFor('burst 2').dismissed).toBe(false);
    expect(storeFor('burst 2').dismissReason).toBeUndefined();

    // Keep draining: each retirement frees a slot, the next queued toast is
    // promoted into it, and the toast it replaces only unmounts after its exit.
    for (let elapsed = promotedAt; elapsed < drainMs; elapsed += DRAIN_TICK) {
      act(() => {
        jest.advanceTimersByTime(DRAIN_TICK);
      });
    }

    expect(screen.queryByText(/burst /)).toBeNull();
    expect(getState().toasts).toEqual([]);
    jest.useRealTimers();
  });

  it('still shows the toast while its exit is playing', () => {
    jest.useFakeTimers();

    render(<Toaster />);
    act(() => {
      toast('mid exit', { duration: 'short' });
    });

    act(() => {
      jest.advanceTimersByTime(deadline() + EPSILON);
    });

    // Past the deadline, so the toast really has been dismissed — but the exit
    // animation is only 400ms, and unmounting here would cut it off, which is
    // the exact failure mode the removal delay exists to prevent.
    expect(screen.getByText('mid exit')).toBeTruthy();
    jest.useRealTimers();
  });
});
