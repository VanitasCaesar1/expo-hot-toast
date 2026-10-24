import { render, screen, cleanup } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as Reanimated from 'react-native-reanimated';
import { ToastIcon, CHECK_PATH_LENGTH } from '../src/components/icons';
import { ToastBar } from '../src/components/toast-bar';
import type { ToastBarProps } from '../src/components/toast-bar';
import { defaultTheme, mergeTheme } from '../src/core/defaults';
import type { Toast } from '../src/core/types';

/*
 * The Reanimated stub in jest.setup.js collapses `withTiming` and `withDelay`
 * to their target value, which throws the configured timings away. They are
 * spied on instead (same approach as gesture-physics.test.tsx) and the timings
 * are read back from the recorded calls. `useAnimatedProps` and
 * `useAnimatedStyle` are evaluated once at render, so the host node shows the
 * first frame.
 */

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

type HostNode = { props: Record<string, any> };

function hosts(name: string): HostNode[] {
  return (
    screen as unknown as { UNSAFE_queryAllByType: (type: string) => HostNode[] }
  ).UNSAFE_queryAllByType(name);
}

function spyTimings() {
  return {
    delay: jest.spyOn(Reanimated, 'withDelay'),
    timing: jest.spyOn(Reanimated, 'withTiming'),
  };
}

const makeToast = (overrides: Partial<Toast> = {}): Toast => ({
  type: 'success',
  id: 'toast-1',
  message: 'hello',
  pauseDuration: 0,
  resolvedPosition: 'top-center',
  depth: 0,
  createdAt: 0,
  visible: true,
  dismissed: false,
  ...overrides,
});

/** Only what these tests vary; the rest is inert. */
const Bar = (props: Pick<ToastBarProps, 'toast' | 'theme' | 'reduceMotion'>) => (
  <ToastBar
    atTop
    reverseOrder={false}
    onDismiss={jest.fn()}
    onPressIn={jest.fn()}
    onPressOut={jest.fn()}
    panThreshold={0}
    {...props}
  />
);

const delaysOf = (spy: jest.SpiedFunction<typeof Reanimated.withDelay>) =>
  spy.mock.calls.map((call) => call[0]);

describe('success checkmark draw-in', () => {
  it('measures the path from its two segments', () => {
    expect(CHECK_PATH_LENGTH).toBeCloseTo(Math.hypot(11, 11) + Math.hypot(5, 5), 10);
    expect(CHECK_PATH_LENGTH).toBeCloseTo(22.627, 3);
  });

  it('starts undrawn: dash offset equals the path length', () => {
    render(<ToastIcon kind="success" size={22} theme={defaultTheme} />);

    const path = hosts('Path')[0]!;
    expect(path.props.animatedProps.strokeDashoffset).toBeCloseTo(CHECK_PATH_LENGTH, 10);
    // One dash exactly as long as the path, and a gap too wide to repeat in it.
    expect(path.props.strokeDasharray[0]).toBeCloseTo(CHECK_PATH_LENGTH, 10);
    expect(path.props.strokeDasharray[1]).toBeGreaterThan(CHECK_PATH_LENGTH);
  });

  it('draws over 200ms, ease-out, after a 200ms delay', () => {
    const spies = spyTimings();
    render(<ToastIcon kind="success" size={22} theme={defaultTheme} />);

    expect(delaysOf(spies.delay)).toEqual([200]);
    expect(spies.timing).toHaveBeenCalledTimes(1);
    const [target, config] = spies.timing.mock.calls[0]!;
    expect(target).toBe(1);
    expect(config).toMatchObject({ duration: 200 });
    expect(typeof (config as { easing: unknown }).easing).toBe('function');
    // The pop's overshoot curve would make the tick bounce.
    expect((config as { easing: unknown }).easing).not.toBe(defaultTheme.motion.iconEasing);
  });

  it('does not replay on a re-render', () => {
    const spies = spyTimings();
    const { rerender } = render(<ToastIcon kind="success" size={22} theme={defaultTheme} />);
    rerender(<ToastIcon kind="success" size={24} theme={defaultTheme} />);

    expect(spies.delay).toHaveBeenCalledTimes(1);
  });

  it('renders the finished check, with no animation, under Reduce Motion', () => {
    const spies = spyTimings();
    render(<ToastIcon kind="success" size={22} theme={defaultTheme} reduceMotion />);

    expect(hosts('Path')[0]!.props.animatedProps.strokeDashoffset).toBe(0);
    expect(spies.delay).not.toHaveBeenCalled();
    expect(spies.timing).not.toHaveBeenCalled();
  });
});

describe('error mark', () => {
  it('leaves the circle to the pop and starts the mark hidden', () => {
    render(<ToastIcon kind="error" size={22} theme={defaultTheme} />);

    expect(hosts('Circle')[0]!.props.animatedProps).toBeUndefined();
    expect(hosts('Path')[0]!.props.animatedProps.opacity).toBe(0);
  });

  it('fades the mark in 150ms after the pop starts, over 200ms', () => {
    const spies = spyTimings();
    render(<ToastIcon kind="error" size={22} theme={defaultTheme} />);

    expect(delaysOf(spies.delay)).toEqual([defaultTheme.motion.iconPopDelay + 150]);
    expect(spies.timing.mock.calls[0]![1]).toMatchObject({ duration: 200 });
  });

  it('follows a retuned iconPopDelay', () => {
    const spies = spyTimings();
    const theme = mergeTheme(defaultTheme, { motion: { iconPopDelay: 40 } });
    render(<ToastIcon kind="error" size={22} theme={theme} />);

    expect(delaysOf(spies.delay)).toEqual([190]);
  });

  it('shows the mark at once under Reduce Motion', () => {
    const spies = spyTimings();
    render(<ToastIcon kind="error" size={22} theme={defaultTheme} reduceMotion />);

    expect(hosts('Path')[0]!.props.animatedProps.opacity).toBe(1);
    expect(spies.delay).not.toHaveBeenCalled();
  });
});

describe('ToastBar icon pop', () => {
  const popTheme = mergeTheme(defaultTheme, {
    motion: { iconPop: 777, iconPopDelay: 333, iconEasing: ((t: number) => t * t) as never },
  });

  /** The pop is the only animation delayed by `iconPopDelay` (333 here). */
  const popStarts = (spies: ReturnType<typeof spyTimings>) =>
    spies.delay.mock.calls.filter((call) => call[0] === 333);

  it('pops after iconPopDelay, over iconPop, with iconEasing', () => {
    const spies = spyTimings();
    render(<Bar toast={makeToast()} theme={popTheme} />);

    expect(popStarts(spies)).toHaveLength(1);
    const pop = spies.timing.mock.calls.find((call) => (call[1] as any)?.duration === 777)!;
    expect(pop[0]).toBe(1);
    expect((pop[1] as any).easing).toBe(popTheme.motion.iconEasing);
  });

  it('starts the icon small and transparent, then scales 0.6 to 1', () => {
    render(<Bar toast={makeToast({ iconStyle: { marginRight: 7 } })} theme={popTheme} />);

    const wrapper = hosts('View').find((node) => flattened(node.props.style).marginRight === 7)!;
    expect(flattened(wrapper.props.style).opacity).toBe(0);
    expect(flattened(wrapper.props.style).transform).toEqual([{ scale: 0.6 }]);
  });

  it('pops again when the type changes in place, as in toast.promise', () => {
    const spies = spyTimings();
    const { rerender } = render(<Bar toast={makeToast({ type: 'loading' })} theme={popTheme} />);
    expect(popStarts(spies)).toHaveLength(1);

    rerender(<Bar toast={makeToast({ type: 'success' })} theme={popTheme} />);
    expect(popStarts(spies)).toHaveLength(2);
  });

  it('does not pop again for a re-render that changes nothing about the icon', () => {
    const spies = spyTimings();
    const { rerender } = render(<Bar toast={makeToast()} theme={popTheme} />);
    rerender(<Bar toast={makeToast({ message: 'new words' })} theme={{ ...popTheme }} />);

    expect(popStarts(spies)).toHaveLength(1);
  });

  it('does not pop on the way out', () => {
    const spies = spyTimings();
    const { rerender } = render(<Bar toast={makeToast()} theme={popTheme} />);
    rerender(<Bar toast={makeToast({ visible: false, dismissed: true })} theme={popTheme} />);

    expect(popStarts(spies)).toHaveLength(1);
  });

  it('pops again if the toast is revived', () => {
    const spies = spyTimings();
    const { rerender } = render(<Bar toast={makeToast()} theme={popTheme} />);
    rerender(<Bar toast={makeToast({ visible: false, dismissed: true })} theme={popTheme} />);
    rerender(<Bar toast={makeToast()} theme={popTheme} />);

    expect(popStarts(spies)).toHaveLength(2);
  });

  it('shows the icon in its final state, with no pop, under Reduce Motion', () => {
    const spies = spyTimings();
    render(
      <Bar
        toast={makeToast({ iconStyle: { marginRight: 7 } })}
        theme={popTheme}
        reduceMotion
      />,
    );

    const wrapper = hosts('View').find((node) => flattened(node.props.style).marginRight === 7)!;
    expect(flattened(wrapper.props.style).opacity).toBe(1);
    expect(flattened(wrapper.props.style).transform).toEqual([{ scale: 1 }]);
    expect(popStarts(spies)).toHaveLength(0);
    // And the glyph inside draws no animation either.
    expect(hosts('Path')[0]!.props.animatedProps.strokeDashoffset).toBe(0);
    expect(spies.delay).not.toHaveBeenCalled();
  });
});

function flattened(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flattened(entry)), {});
}
