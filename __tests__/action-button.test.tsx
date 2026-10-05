import { render, screen, fireEvent, act, cleanup } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Toaster } from '../src/components/toaster';
import { ToastBar } from '../src/components/toast-bar';
import type { ToastBarProps } from '../src/components/toast-bar';
import { defaultMotion, defaultTheme } from '../src/core/defaults';
import { __resetIdCounter } from '../src/core/ids';
import { __resetStore, getState } from '../src/core/store';
import { toast } from '../src/core/toast';
import type { Toast, ToastAction } from '../src/core/types';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

afterEach(() => {
  // Unmount before the store and the clock go away, as a real app tears a Toaster
  // down. Otherwise pending removal timers survive into the next test.
  cleanup();
  __resetStore();
  jest.useRealTimers();
});

/** A complete, valid Toast, as the queue would hand it to the bar. */
function makeToast(overrides: Partial<Toast> = {}): Toast {
  return {
    type: 'blank',
    id: 'toast-1',
    message: 'hello',
    pauseDuration: 0,
    // Derived by the queue rather than by the bar, but still required on the type.
    resolvedPosition: 'top-center',
    depth: 0,
    createdAt: 0,
    visible: true,
    dismissed: false,
    ...overrides,
  };
}

/**
 * Renders the bar directly, so a failure points at the button rather than at the
 * queue or the Toaster. `panThreshold: 0` keeps the drag path out of the way.
 */
function renderBar(
  toastOverrides: Partial<Toast> = {},
  overrides: Partial<Omit<ToastBarProps, 'toast'>> = {},
) {
  const props: ToastBarProps = {
    toast: makeToast(toastOverrides),
    theme: defaultTheme,
    atTop: false,
    reverseOrder: false,
    onDismiss: jest.fn(),
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
    panThreshold: 0,
    ...overrides,
  };

  return { ...render(<ToastBar {...props} />), props };
}

const action = (over: Partial<ToastAction> = {}): ToastAction => ({
  label: 'Undo',
  onPress: jest.fn(),
  ...over,
});

describe('ToastBar — action button', () => {
  it('renders the action label when an action is set', () => {
    renderBar({ action: action() });
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('renders no button at all when no action is set', () => {
    renderBar();
    // Nothing to assert on "absent" other than absence: no label, and no
    // button-role node beyond the toast's own alert.
    expect(screen.queryByText('Undo')).toBeNull();
    expect(
      (screen as unknown as { UNSAFE_queryAllByType: (t: string) => unknown[] }).UNSAFE_queryAllByType(
        'Pressable',
      ),
    ).toHaveLength(1);
  });

  it('exposes the action to assistive tech as a button labelled by its label', () => {
    // The bar's outer node is an `alert` labelled with the message; without a
    // role and a label of its own the trailing pill is unreachable by VoiceOver
    // and by accessibility automation.
    renderBar({ action: action({ label: 'Retry' }) });

    const button = screen.getByLabelText('Retry');
    expect(button.props.accessibilityRole).toBe('button');
    // Asserted off the props rather than through `getByRole`: role queries do not
    // index host Pressables under this preset, the same reason the close-button
    // suite reads `accessibilityRole` off the node.
    // The message keeps its own alert, so the two do not collide.
    expect(screen.getByLabelText('hello').props.accessibilityRole).toBe('alert');
  });

  it('calls onPress and dismisses the toast when pressed', () => {
    const onDismiss = jest.fn();
    const onPress = jest.fn();
    renderBar({ action: action({ onPress }) }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('Undo'));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reports the dismissal as "action"', () => {
    // Distinct from `tap` on purpose: analytics that cannot tell a user
    // cancelling from a user acting are measuring the wrong thing, and an Undo
    // that reads as "ignored" is a genuine bug report.
    const onDismiss = jest.fn();
    renderBar({ action: action() }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('Undo'));
    });

    expect(onDismiss).toHaveBeenCalledWith('toast-1', 'action');
  });

  it('runs onPress before the dismissal, so an Undo lands while the toast is still there', () => {
    // Ordering is the whole point of the comment in src: an Undo that reverses
    // state should take effect before the queue forgets the toast exists.
    const order: string[] = [];
    const onPress = jest.fn(() => order.push('onPress'));
    const onDismiss = jest.fn(() => order.push('onDismiss'));

    renderBar({ action: action({ onPress }) }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('Undo'));
    });

    expect(order).toEqual(['onPress', 'onDismiss']);
  });

  it('leaves the toast on screen when the handler throws', () => {
    // A throwing Undo strands the toast: `onPress` runs before `onDismiss`, and
    // nothing catches in between, so the dismissal never happens and the user is
    // left with a permanently pinned toast. Asserted as observed so the gap is
    // recorded rather than assumed; wrapping the handler call in
    // src/components/toast-bar.tsx makes this fail.
    const onDismiss = jest.fn();
    renderBar(
      {
        action: action({
          onPress: () => {
            throw new Error('handler blew up');
          },
        }),
      },
      { onDismiss },
    );

    expect(() =>
      act(() => {
        fireEvent.press(screen.getByLabelText('Undo'));
      }),
    ).toThrow('handler blew up');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('tints the label from action.color, falling back to the theme token', () => {
    const { toJSON } = renderBar({ action: action({ color: '#ff0000' }) });
    expect(findStyle(toJSON(), (s) => s.color === '#ff0000')).toBeTruthy();

    screen.rerender(
      <ToastBar
        {...renderBar({ action: action() }).props}
        toast={makeToast({ action: action() })}
      />,
    );
    expect(findStyle(screen.toJSON(), (s) => s.color === defaultTheme.actionColor)).toBeTruthy();
  });

  it('does not fire the toast-wide tap dismissal alongside the action', () => {
    // dismissOnTap is a bar-level affordance; the action pill is a child of the
    // same Pressable, so the two reasons must not both be reported.
    const onDismiss = jest.fn();
    renderBar({ action: action(), dismissOnTap: true }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('Undo'));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('toast-1', 'action');
  });
});

describe('Toaster — action button', () => {
  it('runs the handler while the toast is still in the store, and reports "action" once it leaves', () => {
    jest.useFakeTimers();
    const order: string[] = [];

    render(<Toaster />);
    act(() => {
      toast('Item archived', {
        duration: 60_000,
        action: {
          label: 'Undo',
          onPress: () => {
            const stored = getState().toasts[0]!;
            order.push(
              `onPress:visible=${String(stored.visible)}:reason=${stored.dismissReason ?? 'none'}`,
            );
          },
        },
        onDismiss: (_id, reason) => order.push(`onDismiss:${reason}`),
      });
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('Undo'));
    });

    // Read the store from inside the handler: the toast has to still be there,
    // still visible, and not yet carrying a dismiss reason.
    expect(order).toEqual(['onPress:visible=true:reason=none']);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    act(() => {
      jest.advanceTimersByTime(defaultMotion.exit + 20);
    });

    expect(order).toEqual(['onPress:visible=true:reason=none', 'onDismiss:action']);
    expect(getState().toasts).toHaveLength(0);
  });

  it('applies a per-toaster default action to a toast that sets none', () => {
    // The default has to survive resolveToast's option merge, or a Toaster-level
    // `action` would be a documented option that renders nothing.
    const onPress = jest.fn();
    render(<Toaster toastOptions={{ action: { label: 'Retry', onPress } }} />);

    act(() => {
      toast('Upload failed');
    });

    expect(screen.getByText('Retry')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByLabelText('Retry'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("lets a toast's own action win over a Toaster-level default", () => {
    // The precedence is Toaster default -> per-type default -> the toast, and the
    // toast has to come last. A Toaster-level `action` is a *default*, so its job
    // is to fill in the toasts that name no button of their own; the moment it
    // outranks the toast, an app-wide "Retry" replaces the "Details" a single
    // toast deliberately asked for, and that toast has no way to opt out. The
    // previous test covers the same ladder at the `resolveToast` level with no
    // renderer in the way; this one proves it survives the whole path into the
    // tree, so a regression cannot hide behind a merge that never reaches a bar.
    const fallback = jest.fn();
    const own = jest.fn();

    render(
      <Toaster toastOptions={{ action: { label: 'Retry', onPress: fallback } }}>
        {({ toast: t }) => (
          <ToastBar
            toast={t}
            theme={defaultTheme}
            atTop={false}
            reverseOrder={false}
            onDismiss={jest.fn()}
            onPressIn={jest.fn()}
            onPressOut={jest.fn()}
            panThreshold={0}
          />
        )}
      </Toaster>,
    );

    act(() => {
      toast('Upload failed', { action: { label: 'Details', onPress: own } });
    });

    // Exactly one button, and it is the toast's own.
    expect(screen.getByText('Details')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();

    act(() => {
      fireEvent.press(screen.getByLabelText('Details'));
    });
    expect(own).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** First node in the tree whose flattened style satisfies `predicate`. */
function findStyle(node: unknown, predicate: (style: Record<string, any>) => boolean): boolean {
  if (!node || typeof node !== 'object') return false;
  const candidate = node as { props?: Record<string, any>; children?: unknown[] };
  if (predicate(flatten(candidate.props?.style))) return true;
  for (const child of candidate.children ?? []) {
    if (findStyle(child, predicate)) return true;
  }
  return false;
}

function flatten(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flatten(entry)), {});
}
