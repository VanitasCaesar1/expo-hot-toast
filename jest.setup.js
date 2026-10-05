/* eslint-env jest */

/**
 * The React Native mock that ships with jest-expo omits `StyleSheet.flatten`,
 * which @testing-library/react-native calls internally on every query. Without
 * it, `getByTestId` throws before any assertion runs, so the gap has to be
 * filled here rather than worked around in each test.
 */
const ReactNative = require('react-native');
if (typeof ReactNative.StyleSheet.flatten !== 'function') {
  ReactNative.StyleSheet.flatten = (style) => {
    if (!style) return undefined;
    if (!Array.isArray(style)) return style;
    return style
      .filter(Boolean)
      .reduce((acc, entry) => Object.assign(acc, ReactNative.StyleSheet.flatten(entry)), {});
  };
}

/**
 * Hand-written Reanimated stub.
 *
 * Reanimated ships its own `react-native-reanimated/mock`, but in v4 that mock
 * transitively imports `TurboModuleRegistry.get('ReanimatedModule')`, which is
 * undefined under Jest — so requiring it throws before any test runs. The
 * shipped `jest/resolver.js` only strips `.native` extensions; it does not fix
 * the missing TurboModule.
 *
 * A local stub is both simpler and more useful. Reanimated animations are
 * worklets that execute on the UI thread and never run in a unit test, so there
 * is nothing to faithfully simulate. What the tests need is for components to
 * mount and keep their host output inspectable, which this provides while
 * keeping `Animated.View` a real React Native view.
 *
 * Every helper and require lives inside the factory: Jest forbids a
 * `jest.mock` factory from touching out-of-scope variables, and referencing an
 * outer `const` here fails the whole suite at collection time.
 */
jest.mock('react-native-reanimated', () => {
  const { View, Text, Image, ScrollView } = require('react-native');

  const noopBuilder = () => {
    const builder = {};
    const methods = [
      'duration',
      'easing',
      'springify',
      'damping',
      'stiffness',
      'mass',
      'delay',
    ];
    for (const method of methods) builder[method] = () => builder;
    return builder;
  };

  let sharedValueId = 0;

  const useSharedValue = (initial) => {
    // A real SharedValue is a mutable box; tests read `.value` to assert on
    // what a gesture or animation last set.
    const box = { value: initial };
    sharedValueId += 1;
    box.__id = sharedValueId;
    return box;
  };

  const useAnimatedStyle = (factory) => {
    const result = factory();
    return typeof result === 'function' ? result() : result;
  };

  const withTiming = (toValue) => toValue;

  const Easing = {
    bezier: () => (t) => t,
    linear: (t) => t,
    ease: (t) => t,
    inOut: (t) => t,
  };

  // Plain host views rather than RN's Animated.View. Every animation hook is
  // stubbed above, so there is no animated value left to interpolate — and a
  // plain view keeps `props.style` directly inspectable, which is what every
  // assertion in this suite actually reads.
  const animatedExports = {
    View,
    Text,
    Image,
    ScrollView,
    createAnimatedComponent: (component) => component,
  };

  return {
    __esModule: true,
    default: animatedExports,
    Animated: animatedExports,
    Easing,
    FadeIn: noopBuilder(),
    FadeOut: noopBuilder(),
    FadeInDown: noopBuilder(),
    FadeOutDown: noopBuilder(),
    FadeInUp: noopBuilder(),
    FadeOutUp: noopBuilder(),
    LinearTransition: noopBuilder(),
    SlideInDown: noopBuilder(),
    SlideOutDown: noopBuilder(),
    ZoomIn: noopBuilder(),
    ZoomOut: noopBuilder(),
    entering: noopBuilder(),
    exiting: noopBuilder(),
    layout: noopBuilder(),
    useSharedValue,
    useAnimatedStyle,
    useDerivedValue: (factory) => ({ value: factory() }),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedRefHandler: () => undefined,
    useAnimatedReaction: () => undefined,
    useAnimatedScrollHandler: () => undefined,
    withTiming,
    withSpring: (toValue) => toValue,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: (value) => value,
    runOnJS: (fn) => (...args) => fn(...args),
    runOnUI: (fn) => (...args) => fn(...args),
    ReduceMotion: { System: 0, Always: 1, Never: 2 },
  };
});

// Gesture Handler's shipped Jest setup registers the native module stubs the
// Pan gesture resolves against. Without it, every gesture handler component
// fails to mount.
require('react-native-gesture-handler/jestSetup');

/**
 * `useColorScheme` and the AccessibilityInfo probes both resolve asynchronously
 * and then push an update into the Toaster after mount. React reports each of
 * those as an act() violation for the Toaster component.
 *
 * Only that exact message is dropped. An act() violation originating in a test's
 * own `fireEvent` or `rerender` still surfaces with its component name intact,
 * so this cannot mask a genuine failure — and every assertion in the suite runs
 * regardless, since these updates are inert state synchronisation.
 */
const realConsoleWarn = console.warn;
console.warn = (...args) => {
  const joined = args.map((a) => (typeof a === 'string' ? a : '')).join('\n');
  // jest-expo's setup eagerly pulls in expo-modules-core, which warns about a
  // missing JS logger because no native module is present under Jest. It is
  // emitted after the test environment tears down and is pure harness noise.
  if (joined.includes('ExpoModulesCoreJSLogger')) return;
  realConsoleWarn(...args);
};

const realConsoleError = console.error;
console.error = (...args) => {
  const [format, component] = args;
  // React's act warning is emitted as console.error("An update to %s ...",
  // componentName, stack), so the component name is a separate argument and
  // never appears inside the format string.
  if (
    typeof format === 'string' &&
    format.includes('not wrapped in act') &&
    component === 'Toaster'
  ) {
    return;
  }
  realConsoleError(...args);
};

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

/**
 * `expo-glass-effect` resolves UIGlassEffect lazily from UIKit, which does not
 * exist under Jest. Reporting it unavailable reproduces the iOS < 26 path
 * exactly, which is what lets the opaque fallback be asserted directly.
 * `GLASS_SUPPORTED` reads these at module load, so tests that need the glass
 * rung use `jest.isolateModules` after overriding the predicates.
 */
jest.mock('expo-glass-effect', () => {
  const React = require('react');
  const { View } = require('react-native');

  const GlassView = React.forwardRef((props, ref) =>
    React.createElement(View, {
      ...props,
      ref,
      testID: props.testID ?? 'glass-view',
    }),
  );
  GlassView.displayName = 'GlassView';

  const GlassContainer = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref, testID: props.testID ?? 'glass-container' }, props.children),
  );
  GlassContainer.displayName = 'GlassContainer';

  return {
    __esModule: true,
    GlassView,
    GlassContainer,
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

/**
 * react-native-svg reads `requireNativeComponent(...).Mixin`, which does not
 * exist under Jest, so the real module throws on import. Its shapes render as
 * plain host components here — enough for icon tests to assert that the right
 * glyph is rendered for each toast type.
 */
jest.mock('react-native-svg', () => {
  const React = require('react');

  const host = (name) => {
    const Component = React.forwardRef((props, ref) =>
      React.createElement(name, { ...props, ref }),
    );
    Component.displayName = name;
    return Component;
  };

  return {
    __esModule: true,
    default: host('Svg'),
    Svg: host('Svg'),
    Path: host('Path'),
    Circle: host('Circle'),
    Rect: host('Rect'),
    G: host('G'),
    Line: host('Line'),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  return {
    __esModule: true,
    SafeAreaProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    SafeAreaView: ({ children }) => React.createElement(View, null, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: {
      insets,
      frame: { x: 0, y: 0, width: 390, height: 844 },
    },
  };
});