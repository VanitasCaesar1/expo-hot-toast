import { render, screen, act, within } from '@testing-library/react-native';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Toaster } from '../src/components/toaster';
import { triggerToastHaptic } from '../src/utils/haptics';
import { toast } from '../src/core/toast';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

describe('Toaster — placement', () => {
  it('renders nothing when the queue is empty', () => {
    render(<Toaster />);
    expect(screen.queryByText('nothing here')).toBeNull();
  });

  it('routes a toast to the Toaster default position', () => {
    render(<Toaster position="bottom-center" />);
    act(() => {
      toast('hello');
    });
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('lets a toast override the Toaster position', () => {
    render(<Toaster position="top-center" />);
    act(() => {
      toast('corner', { position: 'bottom-right' });
    });
    expect(screen.getByText('corner')).toBeTruthy();
  });

  it('keeps multiple simultaneous toasts on screen', () => {
    render(<Toaster />);
    act(() => {
      toast('one');
      toast('two');
      toast('three');
    });

    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
    expect(screen.getByText('three')).toBeTruthy();
  });

  it('applies the safe-area inset plus the configured offset', () => {
    // The mock reports top: 47 and bottom: 34. A top-anchored toast at offset 16
    // must sit at 63, not at 16 — otherwise it lands inside the Dynamic Island.
    render(<Toaster position="top-left" offset={16} />);
    act(() => {
      toast('inset');
    });

    const stack = findStack(screen.toJSON(), 'top-left');
    expect(stack).toBeTruthy();
    expect(flatten(stack!.props.style).top).toBe(47 + 16);
  });

  it('anchors bottom stacks to the bottom inset', () => {
    render(<Toaster position="bottom-center" />);
    act(() => {
      toast('low');
    });

    const stack = findStack(screen.toJSON(), 'bottom-center');
    expect(flatten(stack!.props.style).bottom).toBe(34 + 16);
  });
});

describe('Toaster — regions', () => {
  it('isolates toasts between toasterIds', () => {
    render(
      <>
        <Toaster toasterId="main" />
        <Toaster toasterId="sidebar" />
      </>,
    );

    act(() => {
      toast('for main', { toasterId: 'main' });
      toast('for sidebar', { toasterId: 'sidebar' });
    });

    expect(screen.getByText('for main')).toBeTruthy();
    expect(screen.getByText('for sidebar')).toBeTruthy();
  });

  it('does not show a toast in a region that was not targeted', () => {
    render(
      <>
        <Toaster toasterId="main" />
        <Toaster toasterId="sidebar" />
      </>,
    );

    act(() => {
      toast('only main', { toasterId: 'main' });
    });

    expect(screen.getAllByText('only main')).toHaveLength(1);
  });

  it('drops accumulated state when a Toaster unmounts', () => {
    // Otherwise a detached region keeps collecting toasts and pinning timers.
    const view = render(<Toaster toasterId="temporary" />);
    act(() => {
      toast('ephemeral', { toasterId: 'temporary' });
    });
    expect(screen.getByText('ephemeral')).toBeTruthy();

    view.unmount();

    render(<Toaster toasterId="temporary" />);
    expect(screen.queryByText('ephemeral')).toBeNull();
  });
});

describe('Toaster — accessibility', () => {
  it('marks toasts as an alert with a live region', () => {
    render(<Toaster />);
    act(() => {
      toast('read this out');
    });

    const alert = screen.getByLabelText('read this out');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });

  it('honours an explicit accessibilityLabel', () => {
    render(<Toaster />);
    act(() => {
      toast.success('Saved to your profile', {
        accessibilityLabel: 'Profile saved',
      });
    });

    expect(screen.getByLabelText('Profile saved')).toBeTruthy();
  });

  it('announces each toast only once', () => {
    render(<Toaster />);
    act(() => {
      toast('once');
    });
    // A theme change or any re-render must not re-announce a toast the user is
    // already reading, which would make a screen reader repeat itself.
    act(() => {
      toast('second');
    });

    expect(screen.getByLabelText('once')).toBeTruthy();
    expect(screen.getByLabelText('second')).toBeTruthy();
  });

  it('resolves a function message before announcing', () => {
    render(<Toaster />);
    act(() => {
      toast.success((t) => `resolved ${t.type}`);
    });

    expect(screen.getByLabelText('resolved success')).toBeTruthy();
  });
});

describe('Toaster — haptics', () => {
  it('fires a success pattern for a success toast', () => {
    render(<Toaster />);
    act(() => {
      toast.success('done');
    });

    // The system's success pattern, which Apple keeps for a task's outcome.
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('uses a different pattern for an error, so failure does not buzz like success', () => {
    render(<Toaster />);
    act(() => {
      toast.error('broke');
    });

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('stays silent for loading toasts', () => {
    render(<Toaster />);
    act(() => {
      toast.loading('working…');
    });

    // A loading toast can sit on screen for a long time. A repeating buzz would
    // be intolerable, so it must not fire at all.
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('does not re-fire haptics when the component re-renders', () => {
    const view = render(<Toaster />);
    act(() => {
      toast.success('once only');
    });
    view.rerender(<Toaster />);

    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('never lets a haptic failure break the toast', async () => {
    // Typed against the real signature, so the rejected value type-checks.
    (Haptics.notificationAsync as jest.MockedFunction<typeof Haptics.notificationAsync>).mockRejectedValueOnce(new Error('no actuator'));

    render(<Toaster />);
    expect(() =>
      act(() => {
        toast.success('still renders');
      }),
    ).not.toThrow();

    expect(screen.getByText('still renders')).toBeTruthy();
  });
});

describe('Toaster — haptics on Android', () => {
  // Regression: Android buzzed the success pattern for every blank and custom
  // toast, and an unsupported device turned the rejection into an unhandled one.
  afterEach(() => {
    // Restores Platform.OS as well as the spies, so later tests run on iOS.
    jest.restoreAllMocks();
  });
  it('stays silent for blank, custom and loading toasts', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const notify = jest.spyOn(Haptics, 'notificationAsync');

    triggerToastHaptic('blank');
    triggerToastHaptic('custom');
    triggerToastHaptic('loading');

    expect(notify).not.toHaveBeenCalled();
  });

  it('uses the notification patterns for success and error', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const notify = jest.spyOn(Haptics, 'notificationAsync');

    triggerToastHaptic('success');
    triggerToastHaptic('error');

    expect(notify.mock.calls.map((call) => call[0])).toEqual(['success', 'error']);
  });

  it('handles a failed haptic', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    // Jest does not fail a test on an unhandled rejection, so assert that a
    // handler was attached instead of waiting for one to surface.
    const rejected = { catch: jest.fn() };
    jest.spyOn(Haptics, 'notificationAsync').mockReturnValueOnce(rejected as never);

    triggerToastHaptic('error');

    expect(rejected.catch).toHaveBeenCalledTimes(1);
  });
});

describe('Toaster — toastOptions', () => {
  it('applies a per-type bucket', () => {
    // Regression: the Toaster stripped `toastOptions.success` and friends before
    // resolving, so per-type defaults never reached a toast.
    render(<Toaster toastOptions={{ success: { icon: <Text>per-type icon</Text> } }} />);
    act(() => {
      toast.success('done');
      toast.error('broke');
    });

    expect(screen.getAllByText('per-type icon')).toHaveLength(1);
  });

  it('applies an iconTheme from a per-type bucket to the built-in glyph', () => {
    const iconTheme = { primary: '#123456', secondary: '#abcdef' };
    render(<Toaster toastOptions={{ error: { iconTheme } }} />);
    act(() => {
      toast.error('broke');
    });

    const strokes = (
      screen as unknown as {
        UNSAFE_queryAllByType: (type: string) => Array<{ props: Record<string, any> }>;
      }
    )
      .UNSAFE_queryAllByType('Circle')
      .map((node) => node.props.stroke);
    expect(strokes).toEqual(['#123456']);
  });

  it('lets a toast override a Toaster default', () => {
    render(<Toaster toastOptions={{ icon: <Text>default icon</Text> }} />);
    act(() => {
      toast('own', { icon: <Text>own icon</Text> });
    });

    expect(screen.getByText('own icon')).toBeTruthy();
    expect(screen.queryByText('default icon')).toBeNull();
  });
});

describe('Toaster — ContainerComponent', () => {
  it('renders the toasts inside the given container', () => {
    // Stands in for react-native-screens' FullWindowOverlay.
    const Overlay = ({ children }: { children?: React.ReactNode }) => (
      <View testID="overlay">{children}</View>
    );
    render(<Toaster ContainerComponent={Overlay} />);
    act(() => {
      toast('above the sheet');
    });

    expect(within(screen.getByTestId('overlay')).getByText('above the sheet')).toBeTruthy();
  });
});

describe('Toaster — font scaling', () => {
  it('caps the message and the action at the theme multiplier', () => {
    render(<Toaster />);
    act(() => {
      toast('scaled', { action: { label: 'Undo', onPress: () => {} } });
    });

    expect(screen.getByText('scaled').props.maxFontSizeMultiplier).toBe(2);
    expect(screen.getByText('Undo').props.maxFontSizeMultiplier).toBe(2);
  });

  it('can be uncapped with null', () => {
    render(<Toaster theme={{ maxFontSizeMultiplier: null }} />);
    act(() => {
      toast('free');
    });

    expect(screen.getByText('free').props.maxFontSizeMultiplier).toBeUndefined();
  });
});

describe('Toaster — theming', () => {
  it('applies token overrides to the rendered bar', () => {
    render(<Toaster theme={{ radius: 4, paddingVertical: 2 }} />);
    act(() => {
      toast('themed');
    });

    const surface = findByStyle(screen.toJSON(), (style) => style.borderRadius === 4);
    expect(surface).toBeTruthy();
  });

  it('lets a single toast override the Toaster theme', () => {
    // Regression test. `ToastOptions.theme` was typed as the fully resolved
    // ToastTheme rather than a partial override, and nothing in src read the
    // field at all — so a per-toast override compiled only with a cast and then
    // did nothing. Both halves are fixed; this asserts the value lands.
    render(<Toaster theme={{ radius: 4 }} />);
    act(() => {
      toast('per-toast', { theme: { radius: 99 } });
    });

    expect(findByStyle(screen.toJSON(), (style) => style.borderRadius === 99)).toBeTruthy();
    // The Toaster-level value must not leak onto the toast that overrode it.
    expect(findByStyle(screen.toJSON(), (style) => style.borderRadius === 4)).toBeNull();
  });

});

describe('Toaster — custom renderer', () => {
  it('uses the render prop instead of the built-in bar', () => {
    render(
      <Toaster>
        {({ toast: t }) => <Text>custom:{String(t.message)}</Text>}
      </Toaster>,
    );

    act(() => {
      toast('payload');
    });

    expect(screen.getByText('custom:payload')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */


/**
 * Walk the rendered tree for the stack View of a given position. The stack is
 * the only node carrying the anchored inset, which makes it a reliable anchor
 * without hardcoding an index that shifts whenever a position is added.
 */
function findStack(node: unknown, position: string): { props: Record<string, any> } | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { props?: Record<string, any>; children?: unknown[] };

  const style = flatten(candidate.props?.style);
  const matches =
    position.startsWith('top')
      ? typeof style.top === 'number' && style.bottom === undefined
      : typeof style.bottom === 'number' && style.top === undefined;

  if (matches && style.position === 'absolute') return candidate as never;

  for (const child of candidate.children ?? []) {
    const found = findStack(child, position);
    if (found) return found;
  }
  return null;
}

function flatten(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flatten(entry)), {});
}

/** First node in the tree whose flattened style satisfies `predicate`. */
function findByStyle(
  node: unknown,
  predicate: (style: Record<string, any>) => boolean,
): Record<string, any> | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { props?: Record<string, any>; children?: unknown[] };
  if (predicate(flatten(candidate.props?.style))) return candidate.props?.style ?? null;
  for (const child of candidate.children ?? []) {
    const found = findByStyle(child, predicate);
    if (found) return found;
  }
  return null;
}