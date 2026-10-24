import * as React from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassContainer } from 'expo-glass-effect';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DefaultToastOptions,
  DismissReason,
  GlassConfig,
  Toast,
  ToastPosition,
  ToastThemeOverride,
} from '../core/types';
import { useToaster, useToasterCleanup } from '../core/use-toaster';
import { toast } from '../core/toast';
import type { DropPolicy } from '../core/store';
import { useToastTheme, mergeTheme } from '../theme/tokens';
import { useReduceMotion, useReduceTransparency, announce } from '../utils/a11y';
import { triggerToastHaptic } from '../utils/haptics';
import { ToastBar, ToastBarContext } from './toast-bar';
import type { ToastBarContextValue } from './toast-bar';
import { resolveValue } from '../core/store';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export interface ToasterProps {
  /** Default position for toasts that don't specify one. Default top-center. */
  position?: ToastPosition;
  toastOptions?: DefaultToastOptions;
  /** Newest toast at the far end of the stack. Default false. */
  reverseOrder?: boolean;
  /**
   * Gap between toasts in px. Default 14. Also the GlassContainer spacing.
   *
   * Named `gap` to match both Sonner implementations, which converged on it
   * independently. `gutter` is still accepted as a deprecated alias.
   */
  gap?: number;
  /** @deprecated Renamed to `gap`. */
  gutter?: number;
  /** Inset from the screen edge in px, added to the safe-area inset. Default 16. */
  offset?: number;
  /**
   * Max toasts visible per position. Default 3.
   *
   * A *soft* limit: the overflow stays queued and is promoted into the freed slot
   * on dismissal, with its timer unarmed so it cannot expire unseen.
   */
  visibleToasts?: number;
  /** @deprecated Renamed to `visibleToasts`. */
  toastLimit?: number;
  /** How many over-limit toasts wait before `dropPolicy` applies. Default 10. */
  maxPending?: number;
  /** Which end of the pending buffer to drop when it overflows. */
  dropPolicy?: DropPolicy;
  toasterId?: string;
  /** Token overrides. Merged over the light/dark default. */
  theme?: ToastThemeOverride;
  /**
   * Force light or dark tokens instead of following the system.
   *
   * Needed whenever the app's own surface does not follow the OS setting —
   * a forced-dark UI on a light-mode system would otherwise get dark text on a
   * dark material, which is effectively unreadable.
   */
  colorScheme?: 'light' | 'dark';
  /** Glass configuration, or false to force the opaque surface. */
  glass?: boolean | GlassConfig;
  /** Distance a toast must be dragged before it dismisses. 0 disables. Default 72. */
  panThreshold?: number;
  containerStyle?: StyleProp<ViewStyle>;
  /** Freezes all timers in this region. */
  paused?: boolean;
  /**
   * Play a haptic when a success or error toast appears. Default true. A
   * toast's own `haptics` option wins.
   */
  haptics?: boolean;
  /**
   * Component to render the Toaster inside, instead of in place.
   *
   * Pass `FullWindowOverlay` from `react-native-screens` on iOS to show toasts
   * above native modals and sheets, which otherwise cover them. The content is
   * wrapped in its own `GestureHandlerRootView`, which gestures need inside a
   * separate window.
   */
  ContainerComponent?: React.ComponentType<{ children?: React.ReactNode }>;
  /** Custom renderer. Falls back to the built-in bar. */
  children?: (props: { toast: Toast; theme: ReturnType<typeof useToastTheme> }) => React.ReactNode;
}

const POSITIONS: ToastPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

const isTop = (position: ToastPosition) => position.startsWith('top');
const isCenter = (position: ToastPosition) => position.includes('center');
const isRight = (position: ToastPosition) => position.includes('right');

export function Toaster({
  position = 'top-center',
  toastOptions,
  reverseOrder = false,
  gap,
  gutter,
  offset = 16,
  toastLimit,
  toasterId = 'default',
  theme: themeOverride,
  colorScheme,
  visibleToasts,
  maxPending,
  dropPolicy,
  glass,
  panThreshold = 72,
  containerStyle,
  paused,
  haptics = true,
  ContainerComponent,
  children,
}: ToasterProps) {
  const resolvedGap = gap ?? gutter ?? 14;

  const insets = useSafeAreaInsets();
  const theme = useToastTheme(themeOverride, colorScheme);
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();

  const { toasts, startPause, endPause } = useToaster({
    toastOptions,
    toasterId,
    toastLimit,
    visibleToasts,
    maxPending,
    dropPolicy,
    defaultPosition: position,
    paused,
    // The exit still has to finish before the unmount, so the live duration is
    // used rather than a hardcoded default — a consumer who lengthens the exit
    // animation would otherwise have toasts vanish mid-flight.
    exitDuration: theme.motion.exit,
    motion: theme.motion,
  });

  useToasterCleanup({ toasterId });

  // Reduce Motion gets its own motion config rather than a global "skip
  // animations" flag, so a reduced-motion user still gets the queue reflow and
  // the dismissal — just without the flight. Removing animation entirely would
  // also remove the feedback that tells them the toast was dismissed.
  const effectiveTheme = React.useMemo(() => {
    if (!reduceMotion) return theme;
    return {
      ...theme,
      motion: {
        ...theme.motion,
        enterTranslate: 0,
        exitTranslate: 0,
        enterScale: 1,
        exitScale: 1,
        iconPopDelay: 0,
      },
    };
  }, [theme, reduceMotion]);

  /**
   * Per-toast side effects, fired exactly once, keyed on a seen-id set.
   *
   * Both of these need to happen on the transition to visible rather than on
   * render: re-announcing on every theme change would make a screen reader
   * repeat itself, and a haptic on re-render would buzz indefinitely while a
   * toast sits on screen.
   *
   * Keyed on the toast's content as well as its id. Updating a toast in place
   * by id re-creates it under the same id — that is exactly how `toast.promise`
   * turns its loading toast into the outcome. An id-only key treated the outcome
   * as already seen, so the success or error of every promise toast was never
   * announced and never produced its haptic. A re-render keeps all three
   * fields identical, so it still fires nothing.
   */
  const seen = React.useRef(
    new Map<string, Pick<Toast, 'createdAt' | 'type' | 'message'>>(),
  );
  React.useEffect(() => {
    toasts.forEach((t) => {
      if (!t.visible) return;
      const last = seen.current.get(t.id);
      if (
        last &&
        last.createdAt === t.createdAt &&
        last.type === t.type &&
        last.message === t.message
      ) {
        return;
      }
      seen.current.set(t.id, { createdAt: t.createdAt, type: t.type, message: t.message });

      // The message, then the description, as one announcement.
      const spoken = [extractLabel(t.message), t.description == null ? undefined : extractLabel(t.description)]
        .filter(Boolean)
        .join('. ');
      const label = t.accessibilityLabel ?? (spoken || undefined);
      if (label) announce(label, t.important ?? t.type === 'error');

      // A loading toast is a placeholder, not an outcome. Buzzing for it would
      // be both premature and, for a long request, unbearable.
      if (t.type !== 'loading' && (t.haptics ?? haptics)) triggerToastHaptic(t.type);
    });
  }, [toasts, haptics]);

  // The seen-set is a de-duplication guard, not state. If it is never pruned it
  // grows for the lifetime of the app, one entry per toast ever shown — a slow
  // leak in exactly the component that should be allocating nothing.
  React.useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    seen.current.forEach((_last, id) => {
      if (!live.has(id)) seen.current.delete(id);
    });
  }, [toasts]);

  const grouped = React.useMemo(() => {
    const map = new Map<ToastPosition, Toast[]>();
    for (const candidate of POSITIONS) map.set(candidate, []);

    toasts.forEach((t) => {
      const resolved = t.position ?? position;
      const bucket = map.get(resolved);
      if (bucket) bucket.push(t);
    });

    return map;
  }, [toasts, position]);

  const keyboard = useKeyboard();

  const glassConfig = typeof glass === 'object' && glass !== null ? glass : {};
  const containerized = glass !== false && glassConfig.containerize !== false;
  const containerSpacing = glassConfig.containerSpacing ?? resolvedGap;

  const content = (
    <View
      // The whole tree is non-interactive except the toasts themselves, so a
      // toast can never swallow a tap meant for the screen behind it. rht does
      // the same with pointer-events: none on the container.
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.root, containerStyle]}
    >
      {POSITIONS.map((candidate) => {
        const bucket = grouped.get(candidate) ?? [];
        if (bucket.length === 0) return null;

        const anchoredTop = isTop(candidate);
        /**
         * Subtract the safe-area inset from the keyboard height.
         *
         * The keyboard already covers the home indicator, so lifting the stack
         * by the full keyboard height plus the inset pushes it twice as far as it
         * needs to go. `max` keeps the stack clear when the keyboard is shorter
         * than the inset it replaces.
         */
        const keyboardInset = Math.max(0, keyboard.height - insets.bottom);
        const bottomInset = keyboardInset > 0 ? keyboardInset : insets.bottom;

        // One GlassContainer per stack, not one per toast. UIKit only merges
        // glass views that share a container, so a container holding a single
        // toast merged nothing: the stack drew as separate chips.
        const Stack = containerized ? GlassContainer : View;

        return (
          <Stack
            key={candidate}
            {...(containerized ? { spacing: containerSpacing } : null)}
            pointerEvents="box-none"
            style={[
              styles.stack,
              {
                gap: resolvedGap,
                alignItems: isCenter(candidate)
                  ? 'center'
                  : isRight(candidate)
                    ? 'flex-end'
                    : 'flex-start',
                // column-reverse puts array index 0 (the newest toast) nearest
                // the anchored edge, which is the whole reason rht carries a
                // sign flip through its offset arithmetic.
                flexDirection:
                  anchoredTop === !reverseOrder ? 'column' : 'column-reverse',
              },
              {
                paddingLeft: insets.left + offset,
                paddingRight: insets.right + offset,
              },
              anchoredTop
                ? { top: insets.top + offset }
                : { bottom: bottomInset + offset },
              !anchoredTop && { paddingBottom: 0 },
            ]}
          >
            {bucket.map((t) => (
              <ToastSlot
                key={t.id}
                toast={t}
                atTop={anchoredTop}
                reverseOrder={reverseOrder}
                colorScheme={colorScheme}
                glass={mergeGlass(glass, t.glass)}
                reduceTransparency={reduceTransparency}
                reduceMotion={reduceMotion}
                // Per-toast tokens win over the Toaster's. `useToastTheme` has
                // already folded in the light/dark base, so this only has to
                // layer the two override bags.
                theme={mergeTheme(effectiveTheme, t.theme)}
                panThreshold={panThreshold}
                onDismiss={(id, reason) =>
                  dismiss(t.id, t.toasterId ?? toasterId, reason)
                }
                onPressIn={startPause}
                onPressOut={endPause}
              >
                {children}
              </ToastSlot>
            ))}
          </Stack>
        );
      })}
    </View>
  );

  if (!ContainerComponent) return content;

  return (
    <ContainerComponent>
      <GestureHandlerRootView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {content}
      </GestureHandlerRootView>
    </ContainerComponent>
  );
}

interface ToastSlotProps extends ToastBarContextValue {
  toast: Toast;
  /** The Toaster-level `glass` setting, already merged with the toast's own. */
  glass: boolean | GlassConfig;
  children?: (props: { toast: Toast; theme: ToastSlotProps['theme'] }) => React.ReactNode;
}

/** Picks the renderer for one toast: custom element, render prop, or the bar. */
function ToastSlot({ toast, glass, children, ...bar }: ToastSlotProps) {
  // `toast.custom` renders the caller's element as-is, with no bar, icon or
  // material — the react-hot-toast contract. It previously went through the
  // default bar like any other type, so a custom element was drawn inside a
  // glass pill next to a stray glyph.
  if (toast.type === 'custom') {
    return <CustomToast toast={toast} motion={bar.theme.motion} />;
  }

  // The Toaster-level `glass` setting is folded into the toast here. The bar
  // reads `toast.glass`, so without this `<Toaster glass={false} />` changed
  // nothing at all: every toast still rendered on glass.
  const resolved = glass === toast.glass ? toast : { ...toast, glass };

  // `bar` is the one source of truth for what the Toaster resolves per toast.
  // The built-in bar takes it as props; a `<ToastBar>` rendered from the render
  // prop reads the same object from context, so it matches without being told.
  return children ? (
    <ToastBarContext.Provider value={bar}>
      {children({ toast: resolved, theme: bar.theme })}
    </ToastBarContext.Provider>
  ) : (
    <ToastBar toast={resolved} {...bar} />
  );
}

/**
 * Placement and motion for a `toast.custom` element, and nothing else.
 *
 * Fades with the toast's `visible` flag rather than through an `exiting`
 * builder, so the fade runs during the store's exit window instead of after it.
 * A function message receives the toast, so a custom element can read
 * `visible` and run its own animation instead.
 */
function CustomToast({ toast: t, motion }: { toast: Toast; motion: ToastSlotProps['theme']['motion'] }) {
  const isVisible = t.visible;
  // Starts at 0 and is driven from an effect, so the first frame fades in
  // rather than appearing at full opacity.
  const opacity = useSharedValue(0);
  React.useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, {
      duration: isVisible ? motion.enter : motion.exit,
      easing: isVisible ? motion.enterEasing : motion.exitEasing,
    });
  }, [isVisible, motion, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.queueShift).easing(motion.enterEasing)}
      pointerEvents="box-none"
      style={[styles.custom, t.style, style]}
    >
      {resolveValue(t.message, t)}
    </Animated.View>
  );
}

function mergeGlass(
  toasterGlass: ToasterProps['glass'],
  toastGlass: Toast['glass'],
): boolean | GlassConfig {
  if (toastGlass === false) return false;
  if (typeof toasterGlass === 'object' && typeof toastGlass === 'object') {
    return { ...toasterGlass, ...toastGlass };
  }
  return toastGlass ?? toasterGlass ?? true;
}

function dismiss(id: string, toasterId: string, reason: DismissReason): void {
  toast.dismiss(id, toasterId, reason);
}

function extractLabel(node: Toast['message']): string | undefined {
  if (typeof node === 'function') return undefined;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    const parts = node
      .map((child) =>
        typeof child === 'string' || typeof child === 'number' ? String(child) : undefined,
      )
      .filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : undefined;
  }
  return undefined;
}

/**
 * Keyboard height, for lifting bottom-anchored stacks clear of it.
 *
 * iOS listens to the will-events so the lift lands as the keyboard starts to
 * move rather than after it has finished. The lift itself is not animated.
 */
function useKeyboard(): { height: number } {
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    const isIOS = Platform.OS === 'ios';
    const showEvent = isIOS ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { height };
}

const styles = StyleSheet.create({
  root: {
    // Above everything, matching rht's z-index 9999 without needing one.
    zIndex: 9999,
    elevation: 9999,
  },
  custom: {
    alignItems: 'center',
  },
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Set per stack from `offset`, so an edge-anchored toast keeps the same
    // inset from the side as from the top or bottom.
  },
});