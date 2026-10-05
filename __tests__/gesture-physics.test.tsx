import { render, screen, cleanup } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Reanimated from 'react-native-reanimated';
import { ToastBar } from '../src/components/toast-bar';
import type { ToastBarProps } from '../src/components/toast-bar';
import { defaultTheme } from '../src/core/defaults';
import type { Toast } from '../src/core/types';

/*
 * The root `__mocks__/react-native-gesture-handler.ts` is a chainable no-op:
 * `Gesture.Pan()` returns an object whose `onUpdate` / `onEnd` throw the
 * callbacks away, so the drag handlers in src are unreachable through it.
 *
 * This file swaps in a recording stub with the same surface. That is strictly
 * better than working around the gap: the callbacks under test are still the
 * ones src handed over, driven directly, instead of a re-implementation of them
 * that would pass even if src were wrong.
 *
 * `buildExiting` is *not* exported, so the exit is exercised through the
 * `exiting` prop the bar actually passes to its outer `Animated.View`. The
 * Reanimated stub in jest.setup.js collapses `withTiming` to its target value,
 * which would throw the duration away, so `withTiming` is spied on — before the
 * render, because `buildExiting` closes over it at mount — and the config is
 * read back from the recorded calls.
 */
const mockGestureConfig: Array<Record<string, unknown>> = [];

jest.mock('react-native-gesture-handler', () => ({
  __esModule: true,
  GestureDetector: ({ children }: { children: unknown }) => children,
  Gesture: {
    Pan: () => {
      const config: Record<string, unknown> = {};
      const chain = {
        enabled: (value: unknown) => {
          config.enabled = value;
          return chain;
        },
        activeOffsetX: (value: unknown) => {
          config.activeOffsetX = value;
          return chain;
        },
        failOffsetY: (value: unknown) => {
          config.failOffsetY = value;
          return chain;
        },
        onUpdate: (cb: unknown) => {
          config.onUpdate = cb;
          return chain;
        },
        onEnd: (cb: unknown) => {
          config.onEnd = cb;
          return chain;
        },
      };
      mockGestureConfig.push(config);
      return chain;
    },
  },
}));

/** The subset of the pan event these handlers read. */
interface PanEvent {
  translationX: number;
  velocityX: number;
}

/** The `exiting` builder, as Reanimated would receive it. */
type ExitingBuilder = () => { initialValues: unknown; animations: unknown };

const makeToast = (overrides: Partial<Toast> = {}): Toast => ({
  type: 'blank',
  id: 'swipe-me',
  message: 'hello',
  pauseDuration: 0,
  resolvedPosition: 'top-center',
  depth: 0,
  createdAt: 0,
  visible: true,
  dismissed: false,
  ...overrides,
});

/**
 * Mounts one bar and hands back the handles its internals expose: the gesture
 * callbacks, the two shared values in declaration order (`dragX`, then `fling`),
 * and the `exiting` builder.
 */
function mountBar(panThreshold: number, onDismiss: ToastBarProps['onDismiss']) {
  const shared: Array<{ value: number }> = [];
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockImplementation(((initial: number) => {
      const box = { value: initial };
      shared.push(box);
      return box;
    }) as unknown as typeof Reanimated.useSharedValue);

  // Installed *before* the render, not after. `buildExiting` closes over
  // `withTiming` when the bar mounts, so a spy added later would never be seen
  // by the builder it is meant to observe.
  const withTiming = jest.spyOn(Reanimated, 'withTiming');

  mockGestureConfig.length = 0;
  render(
    <ToastBar
      toast={makeToast()}
      theme={defaultTheme}
      atTop={false}
      reverseOrder={false}
      onDismiss={onDismiss}
      onPressIn={jest.fn()}
      onPressOut={jest.fn()}
      panThreshold={panThreshold}
    />,
  );

  const config = mockGestureConfig[0]!;
  const exiting = findExiting(screen.toJSON());

  return {
    dragX: shared[0]!,
    fling: shared[1]!,
    drag: (event: Partial<PanEvent>) =>
      (config.onUpdate as (e: Partial<PanEvent>) => void)(event),
    release: (event: Partial<PanEvent>) =>
      (config.onEnd as (e: Partial<PanEvent>) => void)(event),
    /**
     * Durations handed to `withTiming` by one run of the exit builder. Cleared
     * first, so the bar's own enter/exit animations — which also go through
     * `withTiming` — cannot leak into the reading.
     */
    exitDurations: (): number[] => {
      withTiming.mockClear();
      exiting();
      return withTiming.mock.calls.map(
        (call) => (call[1] as { duration?: number } | undefined)?.duration ?? -1,
      );
    },
    config,
  };
}

/** Durations handed to `withTiming` by one run of the exit builder. */
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('ToastBar — drag thresholds', () => {
  it('configures the pan gesture with the distance and axis guards', () => {
    const { config } = mountBar(72, jest.fn());

    expect(config.enabled).toBe(true);
    expect(config.activeOffsetX).toEqual([-12, 12]);
    expect(config.failOffsetY).toEqual([-14, 14]);
  });

  it('disables the pan gesture entirely when panThreshold is 0', () => {
    const { config } = mountBar(0, jest.fn());
    expect(config.enabled).toBe(false);
  });

  it('tracks the finger one-for-one while it drags with the dismissal direction', () => {
    // `dismissalSign` is +1, so a positive translation is the dismissal direction
    // and a negative one is a push back. Only the former may move the toast at
    // all: a bar that answers both directions the same way cannot tell "let go of
    // me" from "put me back", and the elastic branch below exists precisely to
    // make the two behave differently. Asserting the mirrored travel here is what
    // keeps that branch load-bearing — an undamped push back is indistinguishable
    // from a dismiss.
    const { drag, dragX } = mountBar(72, jest.fn());

    for (const travel of [12, 120, 140, 320]) {
      drag({ translationX: travel });
      expect(dragX.value).toBe(travel);
    }

    // Same magnitude, opposite sign: resisted, never 1:1.
    drag({ translationX: -140 });
    expect(dragX.value).not.toBe(-140);
    expect(dragX.value).toBe(resisted(-140));
  });

  it('dismisses a drag that passes the distance threshold', () => {
    const onDismiss = jest.fn();
    const { drag, release } = mountBar(72, onDismiss);

    drag({ translationX: 100 });
    release({ translationX: 100, velocityX: 0 });

    expect(onDismiss).toHaveBeenCalledWith('swipe-me', 'swipe');
  });

  it('does not dismiss a drag that meets neither threshold', () => {
    const onDismiss = jest.fn();
    const { drag, release, dragX } = mountBar(72, onDismiss);

    drag({ translationX: 40 });
    release({ translationX: 40, velocityX: 500 });

    expect(onDismiss).not.toHaveBeenCalled();
    // Sprung back to centre. The Reanimated stub returns `withTiming`'s target,
    // which for the spring-back is 0 — enough to prove the branch was taken.
    expect(dragX.value).toBe(0);
  });

  it('springs back only on the non-dismissing branch', () => {
    const onDismiss = jest.fn();
    const { drag, release, dragX } = mountBar(72, onDismiss);

    drag({ translationX: 40 });
    release({ translationX: 40, velocityX: 100 });
    expect(dragX.value).toBe(0);

    // On the dismissing branch the toast is parked off screen instead, so the
    // exit picks up from where the finger left it rather than snapping to centre
    // first. 100 + sign(100) * 500.
    drag({ translationX: 100 });
    release({ translationX: 100, velocityX: 100 });
    expect(dragX.value).toBe(600);
  });
});

describe('ToastBar — velocity-scaled exit', () => {
  it('dismisses a fling that never reached the distance threshold', () => {
    // The case the fling exists for: a flick of 10px is not a 72px drag, but it
    // is unmistakably an intent to throw the toast away. Without the velocity
    // branch the toast springs back under a finger that was already gone.
    const onDismiss = jest.fn();
    const { release } = mountBar(72, onDismiss);

    release({ translationX: 10, velocityX: 1500 });

    expect(onDismiss).toHaveBeenCalledWith('swipe-me', 'swipe');
  });

  it('records the fling velocity, and its magnitude regardless of direction', () => {
    const { release, fling } = mountBar(72, jest.fn());

    release({ translationX: 10, velocityX: 1500 });
    expect(fling.value).toBe(1500);

    // Only the speed is retained; the exit builder takes `Math.abs` itself.
    release({ translationX: -10, velocityX: -2400 });
    expect(fling.value).toBe(2400);
  });

  it('shortens the exit in proportion to the fling', () => {
    const { fling, exitDurations } = mountBar(72, jest.fn());
    const full = defaultTheme.motion.exit;

    fling.value = 0;
    expect(exitDurations()).toEqual([full, full]);

    // Half the speed shortens the exit by an eighth of it, floored at zero.
    fling.value = 900;
    expect(exitDurations()).toEqual([full * 0.875, full * 0.875]);

    // 1800px/s is "a deliberate flick": the full 25% comes off.
    fling.value = 1800;
    expect(exitDurations()).toEqual([full * 0.75, full * 0.75]);
  });

  it('clamps the shortening so an arbitrarily violent flick cannot skip the exit', () => {
    const { fling, exitDurations } = mountBar(72, jest.fn());
    const floored = defaultTheme.motion.exit * 0.75;

    fling.value = 1800;
    expect(exitDurations()).toEqual([floored, floored]);

    fling.value = 90_000;
    expect(exitDurations()).toEqual([floored, floored]);
  });

  it('gives both exit animations the same duration', () => {
    // translateY and scale are one animation of one toast. Driving them on
    // different clocks is what makes an exit look like two things happening.
    const { fling, exitDurations } = mountBar(72, jest.fn());
    fling.value = 1200;

    const durations = exitDurations();
    expect(durations).toHaveLength(2);
    expect(durations[0]).toBe(durations[1]);
  });

  it('follows a fling observed on a real release', () => {
    // Ties the shared value to the gesture that writes it, so the two halves of
    // the feature cannot drift apart.
    const { release, fling, exitDurations } = mountBar(72, jest.fn());

    release({ translationX: 5, velocityX: 1800 });
    expect(fling.value).toBe(1800);
    expect(exitDurations()).toEqual([
      defaultTheme.motion.exit * 0.75,
      defaultTheme.motion.exit * 0.75,
    ]);
  });
});

/**
 * Travel a push-back drag of `raw` produces, per the resistance curve in src:
 *
 *   raw * 0.35 * (1 / (1 + |raw| * 0.02))
 *
 * Written as the formula rather than a table of literals so the test pins the
 * *curve* — every sample below, and the ceiling they approach — instead of one
 * hand-picked point, and so retuning the two constants is a one-line change
 * rather than a rewrite of the suite.
 */
const resisted = (raw: number): number =>
  raw * 0.35 * (1 / (1 + Math.abs(raw) * 0.02));

/**
 * The ceiling the curve approaches: `0.35 / 0.02`. Worth naming because it is
 * what makes a push back incapable of dismissing anything — no matter how far the
 * finger travels, the toast never moves more than this.
 */
const RESISTANCE_CEILING = 0.35 / 0.02;

/** The default drag distance, matching `Toaster`'s `panThreshold`. */
const PAN_THRESHOLD = 72;

/**
 * A push back must elastically resist rather than track or dismiss.
 *
 * Dragging *against* the dismissal direction is a user trying to shove the toast
 * back where it came from, not throwing it away. Letting that count as a dismiss
 * makes the gesture feel broken — and since the resistance is the only thing
 * standing between a long push back and a swipe, the two directions have to be
 * provably different.
 */
describe('ToastBar — elastic resistance', () => {
  it('resists a drag made against the dismissal direction', () => {
    const onDismiss = jest.fn();
    const { drag, release, dragX } = mountBar(72, onDismiss);

    drag({ translationX: 300 });
    const forwards = dragX.value;

    for (const travel of [-100, -140, -200, -300, -900]) {
      drag({ translationX: travel });
      expect(dragX.value).toBe(resisted(travel));
      // Never the raw travel, in either direction of the comparison.
      expect(dragX.value).not.toBe(travel);
    }

    // The sign is the whole mechanism: the same magnitude is undamped one way and
    // damped the other, so the branch cannot be reached by accident. Undamped
    // travel past the threshold still dismisses, so resistance costs nothing here.
    expect(forwards).toBe(300);
    drag({ translationX: 300 });
    release({ translationX: 300, velocityX: 0 });
    expect(onDismiss).toHaveBeenCalledWith('swipe-me', 'swipe');
  });

  it('saturates, so a push back never reaches the dismiss threshold', () => {
    const { drag, dragX } = mountBar(72, jest.fn());

    // Heavy resistance that flattens out. The travel it allows shrinks toward a
    // ceiling as the finger goes further, rather than growing with the drag.
    drag({ translationX: -50 });
    const near = Math.abs(dragX.value);
    drag({ translationX: -5_000 });
    const far = Math.abs(dragX.value);

    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThan(RESISTANCE_CEILING);

    // The ceiling is strictly below the default pan threshold, which is the whole
    // reason a push back cannot dismiss: the gesture runs out of travel long
    // before it runs out of finger movement.
    expect(RESISTANCE_CEILING).toBeLessThan(PAN_THRESHOLD);
  });

  it('cannot be dismissed by dragging against the dismissal direction', () => {
    // The user-visible consequence of the asymmetry above. A finger that travels
    // the length of the screen in the push-back direction and then lifts off at
    // zero velocity must leave the toast on screen, sprung back to centre —
    // because the resistance never let it move far enough to cross `panThreshold`,
    // and a stationary release carries no fling to fall back on.
    const onDismiss = jest.fn();
    const { drag, release, dragX } = mountBar(72, onDismiss);

    for (const travel of [-200, -900, -4_000]) {
      drag({ translationX: travel });
      // Read before the release, which either parks the toast off screen or
      // springs it back to centre.
      expect(Math.abs(dragX.value)).toBe(Math.abs(resisted(travel)));
      expect(Math.abs(dragX.value)).toBeLessThan(PAN_THRESHOLD);

      release({ translationX: travel, velocityX: 0 });
      expect(onDismiss).not.toHaveBeenCalled();
      // Back to centre, not parked off screen: the non-dismissing branch ran.
      expect(dragX.value).toBe(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * The bar's outer `Animated.View` is the only node carrying an `exiting` prop.
 * Anchoring on the prop rather than a child index keeps this stable if the bar
 * gains another animated wrapper.
 */
function findExiting(node: unknown): ExitingBuilder {
  const found = search(node);
  if (!found) throw new Error('no node with an exiting builder was rendered');
  return found;
}

function search(node: unknown): ExitingBuilder | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  if (typeof candidate.props?.exiting === 'function') {
    return candidate.props.exiting as ExitingBuilder;
  }
  for (const child of candidate.children ?? []) {
    const hit = search(child);
    if (hit) return hit;
  }
  return null;
}
