import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import { ToastBar } from '../src/components/toast-bar';
import type { ToastBarProps } from '../src/components/toast-bar';
import { TOAST_ICON_ACCENTS } from '../src/components/icons';
import { defaultTheme } from '../src/core/defaults';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import type { Toast } from '../src/core/types';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

/** A complete, valid Toast. Every field the store would normally supply is here. */
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
 * Renders ToastBar directly rather than through Toaster, so a failure points
 * at the bar itself instead of at queue plumbing.
 */
function renderBar(
  toast: Partial<Toast> = {},
  overrides: Partial<Omit<ToastBarProps, 'toast'>> = {},
) {
  const props: ToastBarProps = {
    toast: makeToast(toast),
    theme: defaultTheme,
    atTop: false,
    reverseOrder: false,
    onDismiss: jest.fn(),
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
    // Off unless a test asks for the drag path, so the common cases are not
    // quietly depending on gesture behaviour.
    panThreshold: 0,
    ...overrides,
  };

  return { ...render(<ToastBar {...props} />), props };
}

describe('ToastBar — content', () => {
  it('renders the message text', () => {
    renderBar({ message: 'saved to your profile' });
    expect(screen.getByText('saved to your profile')).toBeTruthy();
  });

  it('truncates the message to three lines', () => {
    renderBar({ message: 'a very long message' });
    expect(screen.getByText('a very long message').props.numberOfLines).toBe(3);
  });

  it('resolves a function message against the toast', () => {
    // Per-type copy is the reason `message` is a function; a plain string here
    // would silently lose the toast's own type.
    renderBar({
      type: 'error',
      id: 'e-1',
      message: (t: Toast) => `${t.type} for ${t.id}`,
    });
    expect(screen.getByText('error for e-1')).toBeTruthy();
  });

  it('honours a custom icon renderable over the default', () => {
    renderBar({ type: 'success', icon: <Text>★</Text> });

    expect(screen.getByText('★')).toBeTruthy();
    expect(getSvgNodes('Path')).toHaveLength(0);
    expect(getSvgNodes('Svg')).toHaveLength(0);
  });
});

describe('ToastBar — icons', () => {
  it('draws a single checkmark Path for success', () => {
    renderBar({ type: 'success' });

    expect(getSvgNodes('Path')).toHaveLength(1);
    expect(getSvgNodes('Circle')).toHaveLength(0);
    expect(getSvg('Path').props.d).toBe('M20 6L9 17l-5-5');
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.success);
  });

  it('draws a Circle plus a Path for error', () => {
    // Error is an exclamation mark, so it is genuinely two shapes; a single
    // Path would be indistinguishable from the success tick at a glance.
    renderBar({ type: 'error' });

    expect(getSvgNodes('Circle')).toHaveLength(1);
    expect(getSvgNodes('Path')).toHaveLength(1);
    expect(getSvg('Circle').props.stroke).toBe(TOAST_ICON_ACCENTS.error);
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.error);
  });

  it('draws no icon at all for blank', () => {
    renderBar({ type: 'blank', message: 'quiet' });

    expect(screen.getByText('quiet')).toBeTruthy();
    expect(getSvgNodes('Svg')).toHaveLength(0);
    expect(getSvgNodes('Path')).toHaveLength(0);
    expect(getSvgNodes('Circle')).toHaveLength(0);
  });

  it('draws an ActivityIndicator for loading', () => {
    // ActivityIndicator is not exposed through RNTL's accessibility queries
    // under this preset — queryAllByRole('progressbar') finds nothing — so the
    // only handle on it is its host type name. The absence of Path/Circle/Svg
    // alongside it is what rules out the glyph branches.
    renderBar({ type: 'loading' });

    expect(getActivityIndicators()).toHaveLength(1);
    expect(getSvgNodes('Svg')).toHaveLength(0);
    expect(getSvgNodes('Path')).toHaveLength(0);
    expect(getSvgNodes('Circle')).toHaveLength(0);
  });

  it('sizes the icon from theme.iconSize', () => {
    renderBar({ type: 'success' }, { theme: { ...defaultTheme, iconSize: 30 } });

    expect(getSvg('Svg').props.width).toBe(30);
    expect(getSvg('Svg').props.height).toBe(30);
  });

  it('forwards an iconStyle prop onto the icon wrapper', () => {
    // `iconStyle` is a documented ToastOptions field and the store merges it
    // onto every toast, so the bar is the only place that can apply it. It
    // targets the icon *slot* rather than the glyph, so a consumer can push
    // spacing or tint around the icon without restyling the SVG itself.
    renderBar({ type: 'success', iconStyle: { marginRight: 7 } });

    const wrapper = getViews().find((node) => flatten(node.props.style).marginRight === 7);

    expect(wrapper).toBeTruthy();
  });

  it('applies a textStyle prop onto the message', () => {
    // Same reasoning as iconStyle: resolved by the store, applied here.
    renderBar({ textStyle: { letterSpacing: 2 } });

    const label = screen.getByText('hello');
    expect(flatten(label.props.style)).toMatchObject({ letterSpacing: 2 });
  });

  it('applies a style prop onto the surface wrapper', () => {
    renderBar({ style: { borderWidth: 3, borderColor: 'red' } });

    const surface = getViews().find((node) => flatten(node.props.style).borderWidth === 3);

    expect(flatten(surface!.props.style).borderColor).toBe('red');
  });
});

describe('ToastBar — accessibility', () => {
  it('is an alert in a polite live region', () => {
    renderBar({ message: 'read this out' });

    const alert = screen.getByLabelText('read this out');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });

  it('falls back to the message text for accessibilityLabel', () => {
    // Silence would leave VoiceOver announcing "alert" with no content.
    renderBar({ message: 'Payment declined' });
    expect(screen.getByLabelText('Payment declined')).toBeTruthy();
  });

  it('derives accessibilityLabel from a resolved function message', () => {
    renderBar({
      type: 'error',
      message: (t: Toast) => `failed: ${t.type}`,
    });
    expect(screen.getByLabelText('failed: error')).toBeTruthy();
  });

  it('prefers an explicit accessibilityLabel over the message', () => {
    renderBar({
      message: 'Saved to your profile',
      accessibilityLabel: 'Profile saved',
    });

    expect(screen.getByLabelText('Profile saved')).toBeTruthy();
    expect(screen.queryByLabelText('Saved to your profile')).toBeNull();
  });

  it('advertises the double-tap hint only when tapping dismisses', () => {
    renderBar({ dismissOnTap: true });
    expect(screen.getByLabelText('hello').props.accessibilityHint).toBe(
      'Double tap to dismiss',
    );

    screen.rerender(
      <ToastBar
        {...renderBar({ dismissOnTap: false }).props}
        toast={makeToast({ dismissOnTap: false })}
      />,
    );
    expect(screen.getByLabelText('hello').props.accessibilityHint).toBeUndefined();
  });
});

describe('ToastBar — interaction', () => {
  it('dismisses on press when dismissOnTap is true', () => {
    const onDismiss = jest.fn();
    renderBar({ id: 'tap-me', dismissOnTap: true }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('hello'));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('tap-me', 'tap');
  });

  it('ignores press when dismissOnTap is false', () => {
    const onDismiss = jest.fn();
    renderBar({ dismissOnTap: false }, { onDismiss });

    act(() => {
      fireEvent.press(screen.getByLabelText('hello'));
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('wires onPressIn and onPressOut to their callbacks', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    renderBar({}, { onPressIn, onPressOut });

    const alert = screen.getByLabelText('hello');
    act(() => {
      fireEvent(alert, 'pressIn');
    });
    act(() => {
      fireEvent(alert, 'pressOut');
    });

    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  it('reports its measured height through onLayout', () => {
    // The exit travel is a fraction of this height; the pre-layout constant is
    // only a placeholder, so a toast that never reports would fly the wrong
    // distance out.
    renderBar({});
    const alert = screen.getByLabelText('hello');
    const onLayout = alert.props.onLayout;

    expect(typeof onLayout).toBe('function');
    expect(() =>
      onLayout({ nativeEvent: { layout: { height: 77 } } }),
    ).not.toThrow();
  });

  it('renders with the pan gesture disabled at panThreshold 0', () => {
    expect(() => renderBar({}, { panThreshold: 0 })).not.toThrow();
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('renders with the pan gesture enabled', () => {
    expect(() => renderBar({}, { panThreshold: 40 })).not.toThrow();
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('keeps rendering an invisible toast until it is removed', () => {
    // Reanimated retains the mount during the exit animation; the bar has to
    // stay inspectable while visible is false, not blank out.
    renderBar({ visible: false });
    expect(screen.getByText('hello')).toBeTruthy();
  });

  it('defers to the children render prop when one is given', () => {
    render(
      <ToastBar
        toast={makeToast({ type: 'success', message: 'body copy' })}
        theme={defaultTheme}
        atTop={false}
        reverseOrder={false}
        onDismiss={jest.fn()}
        onPressIn={jest.fn()}
        onPressOut={jest.fn()}
        panThreshold={0}
      >
        {({ message }) => <Text>wrapped:{String(message)}</Text>}
      </ToastBar>,
    );

    expect(screen.getByText('wrapped:body copy')).toBeTruthy();
    expect(screen.queryByText('body copy')).toBeNull();
  });
});

describe('ToastBar — theming', () => {
  it('applies radius, maxWidth and padding to the surface wrapper', () => {
    const theme = {
      ...defaultTheme,
      radius: 4,
      maxWidth: 200,
      paddingVertical: 2,
      paddingHorizontal: 6,
      gap: 3,
    };
    const { toJSON } = renderBar({}, { theme });

    const style = flatten(findSurfaceWrap(toJSON(), theme.radius)?.props?.style);
    expect(style.borderRadius).toBe(4);
    expect(style.maxWidth).toBe(200);
    expect(style.paddingVertical).toBe(2);
    expect(style.paddingHorizontal).toBe(6);
    expect(style.gap).toBe(3);
    // The wrapper clips the opaque fallback's corners; real glass rounds
    // itself, so without this the radius is a lie on the fallback rung.
    expect(style.overflow).toBe('hidden');
  });

  it('applies the text tokens to the message', () => {
    const theme = { ...defaultTheme, color: '#ff00ff', fontSize: 19, lineHeight: 26, fontWeight: '700' as const };
    renderBar({ message: 'themed copy' }, { theme });

    const style = flatten(screen.getByText('themed copy').props.style);
    expect(style.color).toBe('#ff00ff');
    expect(style.fontSize).toBe(19);
    expect(style.lineHeight).toBe(26);
    expect(style.fontWeight).toBe('700');
  });

  it('draws the opaque fallback surface when glass is opted out', () => {
    // The jest mock reports Liquid Glass unavailable, so the real glass rung is
    // unreachable here. Asserting the fallback is still the honest check: it is
    // what every Android and pre-iOS-26 user actually sees.
    const { toJSON } = renderBar({ glass: false });

    expect(screen.queryByTestId('glass-view')).toBeNull();

    const wrap = findSurfaceWrap(toJSON(), defaultTheme.radius);
    const surface = flatten(wrap?.children?.[0]?.props?.style);
    expect(surface.backgroundColor).toBe(defaultTheme.fallbackBackground);
    expect(surface.borderColor).toBe(defaultTheme.border);
    expect(surface.elevation).toBe(defaultTheme.elevation);
  });

  it('draws the same opaque fallback on the default rung', () => {
    const { toJSON } = renderBar({});

    expect(screen.queryByTestId('glass-view')).toBeNull();
    const wrap = findSurfaceWrap(toJSON(), defaultTheme.radius);
    const surface = flatten(wrap?.children?.[0]?.props?.style);
    expect(surface.backgroundColor).toBe(defaultTheme.fallbackBackground);
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Every host name this suite queries by. The host renderer turns the
 * react-native-svg stubs into host elements whose `type` is a plain string, and
 * RNTL's typed `UNSAFE_queryAllByType` only accepts a ComponentType, so the one
 * cast lives here and every assertion above can address a host by name.
 */
type HostNode = { props: Record<string, any> };

function queryAllHosts(name: string): HostNode[] {
  return (
    screen as unknown as {
      UNSAFE_queryAllByType: (type: string) => HostNode[];
    }
  ).UNSAFE_queryAllByType(name);
}

function getSvgNodes(name: 'Svg' | 'Path' | 'Circle'): HostNode[] {
  return queryAllHosts(name);
}

function getSvg(name: 'Svg' | 'Path' | 'Circle'): HostNode {
  const nodes = getSvgNodes(name);
  expect(nodes).toHaveLength(1);
  return nodes[0]!;
}

/** ActivityIndicator is likewise only reachable as a host type name. */
function getActivityIndicators(): HostNode[] {
  return queryAllHosts('ActivityIndicator');
}

/** Plain host views, for locating whichever wrapper a style prop landed on. */
function getViews(): HostNode[] {
  return queryAllHosts('View');
}

/**
 * Locates the surface wrapper by its radius token. Nothing else on this render
 * path sets `borderRadius`, which makes it a stable anchor that survives layout
 * changes — unlike an index into `children`.
 */
function findSurfaceWrap(
  node: unknown,
  radius: number,
): {
  props?: Record<string, any>;
  children?: Array<{ props: Record<string, any> }>;
} | null {
  if (!node || typeof node !== 'object') return null;
  const candidate = node as {
    props?: Record<string, any>;
    children?: Array<{ props: Record<string, any> }>;
  };

  if (flatten(candidate.props?.style).borderRadius === radius) return candidate;

  for (const child of candidate.children ?? []) {
    const found = findSurfaceWrap(child, radius);
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
