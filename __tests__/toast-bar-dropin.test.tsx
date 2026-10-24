import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';
import * as React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Toaster } from '../src/components/toaster';
import { ToastBar, ToastBarContext } from '../src/components/toast-bar';
import type { ToastBarContextValue } from '../src/components/toast-bar';
import { defaultTheme } from '../src/core/defaults';
import { __resetStore, getState } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { toast } from '../src/core/toast';
import { __resetAccessibilityCache } from '../src/utils/a11y';
import type { Toast } from '../src/core/types';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  __resetAccessibilityCache();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

const makeToast = (overrides: Partial<Toast> = {}): Toast => ({
  type: 'blank',
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

describe('ToastBar with no props but the toast', () => {
  it('renders the message and the default theme', () => {
    render(<ToastBar toast={makeToast()} />);

    expect(screen.getByText('hello')).toBeTruthy();
    expect(find((s) => s.maxWidth === defaultTheme.maxWidth)).toBeTruthy();
  });

  it('derives atTop from the toast position', () => {
    // Fresh mounts: the offset is only non-zero before the enter has started.
    const top = render(<ToastBar toast={makeToast({ resolvedPosition: 'top-left' })} />);
    // A top-anchored toast enters from above, so its pre-enter offset is negative.
    expect(enterOffset()).toBeLessThan(0);
    top.unmount();

    render(<ToastBar toast={makeToast({ resolvedPosition: 'bottom-right' })} />);
    expect(enterOffset()).toBeGreaterThan(0);
  });

  it('dismisses through the toast API, in the toast\'s own Toaster', () => {
    toast('hello', { id: 'tap-me', toasterId: 'side', dismissOnTap: true });
    const stored = getState('side').toasts[0]!;

    render(<ToastBar toast={stored} />);
    act(() => {
      fireEvent.press(screen.getByLabelText('hello'));
    });

    expect(getState('side').toasts[0]).toMatchObject({ dismissed: true, dismissReason: 'tap' });
  });

  it('treats press-in and press-out as no-ops', () => {
    render(<ToastBar toast={makeToast()} />);
    const alert = screen.getByLabelText('hello');

    expect(() => {
      act(() => {
        fireEvent(alert, 'pressIn');
        fireEvent(alert, 'pressOut');
      });
    }).not.toThrow();
  });
});

describe('ToastBar context', () => {
  const slot = (overrides: Partial<ToastBarContextValue> = {}): ToastBarContextValue => ({
    theme: { ...defaultTheme, maxWidth: 123 },
    reduceTransparency: false,
    reduceMotion: false,
    atTop: false,
    reverseOrder: false,
    panThreshold: 40,
    onDismiss: jest.fn(),
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
    ...overrides,
  });

  it('reads everything from the Toaster when no prop is given', () => {
    const value = slot();
    render(
      <ToastBarContext.Provider value={value}>
        <ToastBar toast={makeToast({ dismissOnTap: true })} />
      </ToastBarContext.Provider>,
    );

    expect(find((s) => s.maxWidth === 123)).toBeTruthy();
    // atTop: false from context, though the toast says top-center.
    expect(enterOffset()).toBeGreaterThan(0);

    const alert = screen.getByLabelText('hello');
    act(() => {
      fireEvent(alert, 'pressIn');
      fireEvent(alert, 'pressOut');
      fireEvent.press(alert);
    });
    expect(value.onPressIn).toHaveBeenCalledTimes(1);
    expect(value.onPressOut).toHaveBeenCalledTimes(1);
    expect(value.onDismiss).toHaveBeenCalledWith('toast-1', 'tap');
  });

  it('lets an explicit prop win over the context', () => {
    const value = slot();
    const onDismiss = jest.fn();
    render(
      <ToastBarContext.Provider value={value}>
        <ToastBar
          toast={makeToast({ dismissOnTap: true })}
          theme={{ ...defaultTheme, maxWidth: 77 }}
          atTop
          onDismiss={onDismiss}
        />
      </ToastBarContext.Provider>,
    );

    expect(find((s) => s.maxWidth === 77)).toBeTruthy();
    expect(find((s) => s.maxWidth === 123)).toBeNull();
    expect(enterOffset()).toBeLessThan(0);

    act(() => {
      fireEvent.press(screen.getByLabelText('hello'));
    });
    expect(onDismiss).toHaveBeenCalledWith('toast-1', 'tap');
    expect(value.onDismiss).not.toHaveBeenCalled();
  });
});

describe('Toaster render prop with a drop-in ToastBar', () => {
  const dropIn = (
    <Toaster toasterId="main" toastOptions={{ dismissOnTap: true }}>
      {({ toast: t }) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              <Text>drop-in:{message}</Text>
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );

  it('renders react-hot-toast\'s ToastBar pattern', () => {
    render(dropIn);
    act(() => {
      toast.success('saved', { toasterId: 'main' });
    });

    expect(screen.getByText('drop-in:saved')).toBeTruthy();
    // The built-in icon is the `icon` argument.
    expect(hosts('Path')).toHaveLength(1);
  });

  it('routes dismissal to the Toaster that owns the toast', () => {
    render(
      <>
        {dropIn}
        <Toaster toasterId="other" />
      </>,
    );
    act(() => {
      toast('mine', { id: 'mine', toasterId: 'main' });
      toast('theirs', { id: 'theirs', toasterId: 'other', dismissOnTap: false });
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('mine'));
    });

    expect(getState('main').toasts.find((t) => t.id === 'mine')).toMatchObject({
      dismissed: true,
      dismissReason: 'tap',
    });
    expect(getState('other').toasts.find((t) => t.id === 'theirs')!.dismissed).toBe(false);
  });

  it('pauses and resumes the Toaster on press', () => {
    render(dropIn);
    act(() => {
      toast('hello', { toasterId: 'main' });
    });
    const alert = screen.getByLabelText('hello');

    act(() => {
      fireEvent(alert, 'pressIn');
    });
    expect(getState('main').pausedAt).toBeDefined();

    act(() => {
      fireEvent(alert, 'pressOut');
    });
    expect(getState('main').pausedAt).toBeUndefined();
  });

  it('gets the same per-toast theme as the built-in bar: Toaster tokens, then the toast\'s', () => {
    // Two regions side by side, one rendering the built-in bar and one the drop-in.
    render(
      <>
        <Toaster toasterId="built-in" theme={{ maxWidth: 200, gap: 11 }} />
        <Toaster toasterId="drop-in" theme={{ maxWidth: 200, gap: 11 }}>
          {({ toast: t }) => <ToastBar toast={t} />}
        </Toaster>
      </>,
    );
    act(() => {
      toast('one', { toasterId: 'built-in', theme: { maxWidth: 99 } });
      toast('two', { toasterId: 'drop-in', theme: { maxWidth: 99 } });
    });

    // The toast's maxWidth wins; the Toaster's gap, which the toast did not set, survives.
    const surfaces = hosts('View')
      .map((node) => flatten(node.props.style))
      .filter((style) => style.maxWidth === 99);
    expect(surfaces).toHaveLength(2);
    expect(surfaces[1]).toEqual(surfaces[0]);
    expect(surfaces[0]!.gap).toBe(11);
  });

  it('passes Reduce Motion to the drop-in bar as it does to the built-in one', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(
      <Toaster>{({ toast: t }) => <ToastBar toast={t} />}</Toaster>,
    );
    act(() => {
      toast.success('done');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(hosts('Path')[0]!.props.animatedProps.strokeDashoffset).toBe(0);
  });

  it('folds the Toaster glass setting into the toast the render prop receives', () => {
    const seen: Array<Toast['glass']> = [];
    render(
      <Toaster glass={false}>
        {({ toast: t }) => {
          seen.push(t.glass);
          return <ToastBar toast={t} />;
        }}
      </Toaster>,
    );
    act(() => {
      toast('plain');
    });

    expect(seen.at(-1)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type HostNode = { props: Record<string, any> };

function hosts(name: string): HostNode[] {
  return (
    screen as unknown as { UNSAFE_queryAllByType: (type: string) => HostNode[] }
  ).UNSAFE_queryAllByType(name);
}

function flatten(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flatten(entry)), {});
}

/** First View whose flattened style satisfies `predicate`. */
function find(predicate: (style: Record<string, any>) => boolean): HostNode | null {
  return hosts('View').find((node) => predicate(flatten(node.props.style))) ?? null;
}

/**
 * translateY of the bar's transform wrapper before the enter animation has
 * moved it. The Reanimated stub evaluates the style once, at presence 0.
 */
function enterOffset(): number {
  const node = find(
    (s) => Array.isArray(s.transform) && s.transform.some((t: any) => 'translateY' in t),
  )!;
  return flatten(node.props.style).transform.find((t: any) => 'translateY' in t).translateY;
}
