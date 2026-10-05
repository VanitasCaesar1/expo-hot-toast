import * as React from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassContainer } from 'expo-glass-effect';
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
import { ToastBar } from './toast-bar';

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
  children,
}: ToasterProps) {
  const resolvedGap = gap ?? gutter ?? 14;

  const insets = useSafeAreaInsets();
  const theme = useToastTheme(themeOverride, colorScheme);
  const reduceMotion = useReduceMotion();
  const reduceTransparency = useReduceTransparency();

  const { toasts, pending, startPause, endPause } = useToaster({
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
   */
  const seen = React.useRef(new Set<string>());
  React.useEffect(() => {
    toasts.forEach((t) => {
      if (!t.visible || seen.current.has(t.id)) return;
      seen.current.add(t.id);

      const label = t.accessibilityLabel ?? extractLabel(t.message, t);
      if (label) announce(label, t.type === 'error');

      // A loading toast is a placeholder, not an outcome. Buzzing for it would
      // be both premature and, for a long request, unbearable.
      if (t.type !== 'loading') triggerToastHaptic(t.type);
    });
  }, [toasts]);

  // The seen-set is a de-duplication guard, not state. If it is never pruned it
  // grows for the lifetime of the app, one entry per toast ever shown — a slow
  // leak in exactly the component that should be allocating nothing.
  React.useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    seen.current.forEach((id) => {
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

  return (
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

        return (
          <View
            key={candidate}
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
                gap={resolvedGap}
                glass={mergeGlass(glass, t.glass)}
                reduceTransparency={reduceTransparency}
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
          </View>
        );
      })}
    </View>
  );
}

interface ToastSlotProps {
  toast: Toast;
  atTop: boolean;
  reverseOrder: boolean;
  gap: number;
  glass: boolean | GlassConfig;
  reduceTransparency: boolean;
  theme: ReturnType<typeof useToastTheme>;
  panThreshold: number;
  onDismiss: (id: string, reason: DismissReason) => void;
  onPressIn: () => void;
  onPressOut: () => void;
  children?: (props: { toast: Toast; theme: ToastSlotProps['theme'] }) => React.ReactNode;
}

/**
 * Wraps one toast, and is where GlassContainer earns its keep.
 *
 * Every toast is its own GlassView, so naively you get N separate floating
 * chips. Nesting them in a GlassContainer makes UIKit treat them as one
 * continuous material that flows and re-flows as the queue shifts — a merged
 * glass sheet rather than a stack of cards. This is the capability the web has
 * no equivalent for, and the main reason this package is not just a port.
 */
function ToastSlot({
  toast,
  atTop,
  reverseOrder,
  gap,
  glass,
  reduceTransparency,
  theme,
  panThreshold,
  onDismiss,
  onPressIn,
  onPressOut,
  children,
}: ToastSlotProps) {
  const body = children ? (
    children({ toast, theme })
  ) : (
    <ToastBar
      toast={toast}
      theme={theme}
      reduceTransparency={reduceTransparency}
      atTop={atTop}
      reverseOrder={reverseOrder}
      onDismiss={onDismiss}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      panThreshold={panThreshold}
    />
  );

  const config = typeof glass === 'object' && glass !== null ? glass : {};
  if (glass === false || config.containerize === false) return body;

  return (
    <GlassContainer spacing={config.containerSpacing ?? gap}>{body}</GlassContainer>
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

function extractLabel(node: Toast['message'], toast: Toast): string | undefined {
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
  void toast;
  return undefined;
}

/**
 * Keyboard height, plus the keyboard's own animation curve and duration.
 *
 * Reading only `endCoordinates.height` and snapping to it means the stack jumps
 * while the keyboard glides, which reads as a stutter on every focus change.
 * iOS publishes the keyboard's animation parameters on the event; matching them
 * means the toasts move with the keyboard instead of chasing it.
 *
 * Returns a plain object rather than a height so the curve and duration are not
 * thrown away by the caller.
 */
function useKeyboard(): { height: number; duration: number } {
  const [state, setState] = React.useState({ height: 0, duration: 250 });

  React.useEffect(() => {
    const isIOS = Platform.OS === 'ios';
    const showEvent = isIOS ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event: any) => {
      const duration =
        // Present on iOS only, and absent on some third-party keyboards.
        event?.endCoordinates?.screenY === undefined
          ? 250
          : Number(event.duration ?? 250);

      setState({ height: event.endCoordinates.height, duration });
    });

    const hide = Keyboard.addListener(hideEvent, (event: any) => {
      const duration =
        Platform.OS === 'ios' ? Number(event?.duration ?? 250) : 0;
      setState({ height: 0, duration });
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return state;
}

const styles = StyleSheet.create({
  root: {
    // Above everything, matching rht's z-index 9999 without needing one.
    zIndex: 9999,
    elevation: 9999,
  },
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 0,
  },
});