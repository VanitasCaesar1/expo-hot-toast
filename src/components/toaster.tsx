import * as React from 'react';
import { Keyboard, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { GlassContainer } from 'expo-glass-effect';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  DefaultToastOptions,
  DismissReason,
  GlassConfig,
  Toast,
  ToastBlur,
  ToastHaptic,
  ToastPosition,
  ToastThemeOverride,
  ToastType,
} from '../core/types';
import { animationMotion, materialTheme, resolvePreset, resolveVariant } from '../core/presets';
import type { ToastAnimation, ToasterPreset } from '../core/presets';
import { dropProgress } from '../core/progress';
import { useToaster, useToasterCleanup } from '../core/use-toaster';
import { toast } from '../core/toast';
import type { DropPolicy } from '../core/store';
import { useToastTheme, mergeTheme } from '../theme/tokens';
import { useReduceMotion, useReduceTransparency, useScreenReaderEnabled, announce } from '../utils/a11y';
import { DEFAULT_HAPTICS, triggerToastHaptic } from '../utils/haptics';
import { ToastBar, ToastBarContext } from './toast-bar';
import type { StackPlacement, ToastBarContextValue, ToastIcons } from './toast-bar';
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
   * Haptics: `true` plays each type's default (success, error and warning
   * have one), `false` none, or a map from type to haptic:
   * `{ success: 'medium', info: 'light' }`. A toast's own `haptics` wins.
   */
  haptics?: boolean | Partial<Record<ToastType, ToastHaptic>>;
  /**
   * The look to start from. `'auto'` (default): a Material 3 snackbar on
   * Android, rising from the bottom; the glass pill elsewhere. `'glass'` or
   * `'material'` picks one everywhere. `theme` is laid over it.
   */
  preset?: ToasterPreset;
  /** How toasts come and go: `'hot'` (default), `'slide'`, `'fade'`, `'pop'` or `'none'`. */
  animation?: ToastAnimation;
  /** Icons for each type, and the close button, in place of the built-in glyphs. */
  icons?: ToastIcons;
  /**
   * A blur view for Android and iOS before 26, where there is no Liquid Glass:
   * `{ component: BlurView, props: { intensity, blurMethod, blurTarget } }`.
   * Without it they draw the opaque surface. See `ToastBlur`.
   */
  blur?: ToastBlur;
  /**
   * Collapse each stack: older toasts tuck behind the newest, showing only
   * their edges, and the stack fans out while it is pressed. Default false.
   *
   * Ignored with `reverseOrder`, and while a screen reader is running, which
   * needs every toast's content. Neighbouring glass toasts do not blend in a
   * stacked Toaster, because tucked toasts overlap.
   */
  stacked?: boolean;
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

/**
 * Where a stack is drawn. The six positions, plus places some shapes take
 * whatever their position: a HUD in the middle of the screen, the island in
 * the status bar, and a banner against the top or bottom edge.
 */
type Bucket = ToastPosition | 'center' | 'island' | 'banner-top' | 'banner-bottom';
const BUCKETS: Bucket[] = [...POSITIONS, 'center', 'island', 'banner-top', 'banner-bottom'];

function bucketOf(t: Toast, position: ToastPosition, preset: Exclude<ToasterPreset, 'auto'>): Bucket {
  const at = t.position ?? position;
  switch (resolveVariant(t.variant, preset)) {
    case 'hud':
      return 'center';
    case 'island':
      return 'island';
    case 'banner':
      return at.startsWith('bottom') ? 'banner-bottom' : 'banner-top';
    default:
      return at;
  }
}

/**
 * The island's top: just inside the Dynamic Island on iPhones that have one
 * (about 11pt from the top; their top inset is over 50), and just below the
 * notch or status bar everywhere else. It once sat 34 above the inset, which
 * on Android put it over the status bar.
 */
function islandTop(insetTop: number): number {
  return hasDynamicIsland(insetTop) ? 11 : insetTop + 8;
}

/** iPhones with a Dynamic Island have a top inset over 50pt. */
function hasDynamicIsland(insetTop: number): boolean {
  return Platform.OS === 'ios' && insetTop > 50;
}

/**
 * The camera cutout's height. On a Dynamic Island iPhone the island toast
 * starts inside the island and keeps its content below the cutout, as an
 * expanded Live Activity does: centred in it, the text sat behind the cutout.
 */
const DYNAMIC_ISLAND_HEIGHT = 37;

/** How far each toast behind the front one peeks out of a collapsed stack, in px. */
export const STACK_PEEK = 10;
/** How much smaller each toast behind the front one is drawn. */
const STACK_SCALE_STEP = 0.06;
/** How long a fanned-out stack stays open after the finger lifts, in ms. */
const STACK_COLLAPSE_DELAY = 2500;
/** Used for a toast that has not reported its height yet. */
const ASSUMED_TOAST_HEIGHT = 56;

/**
 * Offsets that collapse a stack laid out normally.
 *
 * Toast 0 is at the anchored edge; toast i sits after the i toasts in front of
 * it, each followed by `gap`. Collapsed, toast i's far edge lands `peek` px
 * past the far edge of the one in front, so each shows only a sliver. The
 * offset is the distance from where layout put that far edge to where it
 * should be: up for a top stack, down for a bottom one.
 */
export function stackShifts(
  heights: number[],
  gap: number,
  atTop: boolean,
  peek: number = STACK_PEEK,
): number[] {
  const front = heights[0] ?? 0;
  let before = 0;
  return heights.map((height, i) => {
    const laidOut = before + height;
    before += height + gap;
    const target = front + i * peek;
    return atTop ? target - laidOut : laidOut - target;
  });
}

const isTop = (position: ToastPosition) => position.startsWith('top');
const isCenter = (position: ToastPosition) => position.includes('center');
const isRight = (position: ToastPosition) => position.includes('right');

export function Toaster({
  position: positionProp,
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
  stacked = false,
  preset: presetProp = 'auto',
  animation,
  icons,
  blur: blurProp,
  ContainerComponent,
  children,
}: ToasterProps) {
  const resolvedGap = gap ?? gutter ?? 14;
  const preset = resolvePreset(presetProp);
  // A Material snackbar rises from the bottom, unless a position is given.
  const position: ToastPosition = positionProp ?? (preset === 'material' ? 'bottom-center' : 'top-center');

  const insets = useSafeAreaInsets();
  // The preset's tokens and the animation's motion sit under the consumer's
  // own theme, which wins.
  const system = useColorScheme();
  const scheme: 'light' | 'dark' = (colorScheme ?? system) === 'dark' ? 'dark' : 'light';
  const layered = React.useMemo(() => {
    const base = preset === 'material' ? materialTheme(scheme) : undefined;
    const motion = animationMotion(animation);
    if (!base && !motion) return themeOverride;
    return {
      ...base,
      ...themeOverride,
      motion: { ...motion, ...themeOverride?.motion },
    } as ToastThemeOverride;
  }, [preset, scheme, animation, themeOverride]);
  const theme = useToastTheme(layered, colorScheme);
  const blur = useStableBlur(blurProp);
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReaderEnabled();
  const reduceTransparency = useReduceTransparency();

  const { toasts, startPause, endPause, paused: timersPaused } = useToaster({
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
      if (t.type !== 'loading') {
        const haptic = hapticFor(t, haptics);
        if (haptic) triggerToastHaptic(t.type, haptic);
      }
    });
  }, [toasts, haptics]);

  // The seen-set is a de-duplication guard, not state. If it is never pruned it
  // grows for the lifetime of the app, one entry per toast ever shown — a slow
  // leak in exactly the component that should be allocating nothing.
  React.useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    seen.current.forEach((_last, id) => {
      if (!live.has(id)) {
        seen.current.delete(id);
        // Its progress, if it had one, is no longer drawn anywhere.
        dropProgress(id);
      }
    });
  }, [toasts]);

  /**
   * The collapsed stack. Pressing any toast in it fans the stack out (and
   * pauses the timers, as a press always does); it folds back a moment after
   * the finger lifts, so there is time to reach a toast that has fanned out.
   */
  const collapsible = stacked && !reverseOrder && !screenReader;
  const [expanded, setExpanded] = React.useState(false);
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(collapseTimer.current), []);
  const collapsed = collapsible && !expanded;

  const handlePressIn = React.useCallback(() => {
    startPause();
    if (!collapsible) return;
    clearTimeout(collapseTimer.current);
    setExpanded(true);
  }, [startPause, collapsible]);
  const handlePressOut = React.useCallback(() => {
    endPause();
    if (!collapsible) return;
    clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setExpanded(false), STACK_COLLAPSE_DELAY);
  }, [endPause, collapsible]);

  // Measured toast heights, for tucking each toast exactly behind the ones in
  // front of it. A ref plus a counter: the numbers are bookkeeping, but a new
  // measurement has to re-place the stack.
  const heights = React.useRef(new Map<string, number>());
  const [, setMeasured] = React.useState(0);
  const handleMeasure = React.useCallback((id: string, height: number) => {
    if (heights.current.get(id) === height) return;
    heights.current.set(id, height);
    setMeasured((n) => n + 1);
  }, []);
  React.useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    heights.current.forEach((_height, id) => {
      if (!live.has(id)) heights.current.delete(id);
    });
  }, [toasts]);

  // Everything handed to a toast is kept stable, so ToastSlot's memo holds and
  // one toast's update re-renders that toast alone. Per-toast themes are cached
  // by the toast's own override object; the stack placement by its numbers.
  const themeFor = React.useMemo(() => {
    const cache = new WeakMap<ToastThemeOverride, ToastBarContextValue['theme']>();
    return (override: ToastThemeOverride | undefined) => {
      if (!override) return effectiveTheme;
      let merged = cache.get(override);
      if (!merged) {
        merged = mergeTheme(effectiveTheme, override);
        cache.set(override, merged);
      }
      return merged;
    };
  }, [effectiveTheme]);
  const placements = React.useRef(new Map<string, StackPlacement>()).current;
  const placementFor = (depth: number, shift: number, scale: number, hidden: boolean): StackPlacement => {
    const key = `${depth}|${shift}|${scale}|${hidden}`;
    let placement = placements.get(key);
    if (!placement) {
      placement = { depth, shift, scale, hidden };
      placements.set(key, placement);
    }
    return placement;
  };
  const handleDismiss = React.useCallback(
    (id: string, reason: DismissReason) => dismiss(id, toasterId, reason),
    [toasterId],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<Bucket, Toast[]>();
    for (const candidate of BUCKETS) map.set(candidate, []);

    toasts.forEach((t) => {
      const bucket = map.get(bucketOf(t, position, preset));
      if (bucket) bucket.push(t);
    });

    return map;
  }, [toasts, position, preset]);

  const keyboard = useKeyboard();

  const glassConfig = typeof glass === 'object' && glass !== null ? glass : {};
  // Tucked toasts overlap, and overlapping glass in one container merges into
  // a single blob, so a stacked Toaster keeps each toast's glass separate.
  const containerized = glass !== false && glassConfig.containerize !== false && !stacked;
  const containerSpacing = glassConfig.containerSpacing ?? resolvedGap;

  const content = (
    <View
      // The whole tree is non-interactive except the toasts themselves, so a
      // toast can never swallow a tap meant for the screen behind it. rht does
      // the same with pointer-events: none on the container.
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, styles.root, containerStyle]}
    >
      {BUCKETS.map((candidate) => {
        const bucket = grouped.get(candidate) ?? [];
        if (bucket.length === 0) return null;

        const special = !POSITIONS.includes(candidate as ToastPosition);
        const anchoredTop = candidate === 'banner-bottom' ? false : special ? true : isTop(candidate as ToastPosition);
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
        const shifts = collapsed
          ? stackShifts(
              bucket.map((t) => heights.current.get(t.id) ?? ASSUMED_TOAST_HEIGHT),
              resolvedGap,
              anchoredTop,
            )
          : undefined;

        return (
          <View
            key={candidate}
            pointerEvents="box-none"
            // Positions the stack. When the keyboard lifts it, only this view
            // changes: the toasts inside keep their props and do not re-render.
            style={[
              styles.stack,
              candidate === 'banner-top'
                ? { top: 0 }
                : candidate === 'banner-bottom'
                  ? { bottom: keyboardInset }
                  : [
                      {
                        paddingLeft: insets.left + offset,
                        paddingRight: insets.right + offset,
                      },
                      candidate === 'center'
                        ? styles.center
                        : candidate === 'island'
                          ? { top: islandTop(insets.top) }
                          : anchoredTop
                            ? { top: insets.top + offset }
                            : { bottom: bottomInset + offset },
                    ],
            ]}
          >
          <Stack
            {...(containerized ? { spacing: containerSpacing } : null)}
            pointerEvents="box-none"
            style={[
              {
                gap: resolvedGap,
                alignItems: special || isCenter(candidate as ToastPosition)
                  ? 'center'
                  : isRight(candidate as ToastPosition)
                    ? 'flex-end'
                    : 'flex-start',
                // column-reverse puts array index 0 (the newest toast) nearest
                // the anchored edge, which is the whole reason rht carries a
                // sign flip through its offset arithmetic.
                flexDirection:
                  anchoredTop === !reverseOrder ? 'column' : 'column-reverse',
              },
            ]}
          >
            {bucket.map((t, depth) => (
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
                theme={themeFor(t.theme)}
                panThreshold={panThreshold}
                onDismiss={handleDismiss}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                stack={
                  stacked
                    ? placementFor(
                        depth,
                        shifts?.[depth] ?? 0,
                        collapsed ? 1 - Math.min(depth, 3) * STACK_SCALE_STEP : 1,
                        collapsed && depth > 0,
                      )
                    : undefined
                }
                onMeasure={stacked ? handleMeasure : undefined}
                preset={preset}
                icons={icons}
                blur={blur}
                // Only an Undo countdown needs to know; passing it to every toast
                // would re-render them all whenever one is pressed.
                paused={t.action?.countdown ? timersPaused : false}
                edgeInset={
                  candidate === 'banner-top'
                    ? insets.top
                    : candidate === 'banner-bottom' && keyboardInset === 0
                      ? insets.bottom
                      : candidate === 'island' && hasDynamicIsland(insets.top)
                        ? DYNAMIC_ISLAND_HEIGHT
                        : 0
                }
              >
                {children}
              </ToastSlot>
            ))}
          </Stack>
          </View>
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
const ToastSlot = React.memo(function ToastSlot({ toast, glass: toasterGlass, children, ...bar }: ToastSlotProps) {
  // Merged per render would be a new object whenever both levels set one, which
  // would hand the bar a new toast every time and defeat its memo.
  const glass = React.useMemo(() => toasterGlass, [glassKey(toasterGlass)]);
  const resolved = React.useMemo(
    () => (glass === toast.glass ? toast : { ...toast, glass }),
    [toast, glass],
  );
  const context = React.useMemo(() => bar, Object.values(bar));
  // `toast.custom` renders the caller's element as-is, with no bar, icon or
  // material — the react-hot-toast contract. It previously went through the
  // default bar like any other type, so a custom element was drawn inside a
  // glass pill next to a stray glyph.
  if (toast.type === 'custom') {
    return <CustomToast toast={toast} motion={bar.theme.motion} />;
  }

  // The Toaster-level `glass` setting is folded into the toast here (`resolved`
  // above). The bar reads `toast.glass`, so without this `<Toaster glass={false} />`
  // changed nothing at all: every toast still rendered on glass.
  //
  // `bar` is the one source of truth for what the Toaster resolves per toast.
  // The built-in bar takes it as props; a `<ToastBar>` rendered from the render
  // prop reads the same object from context, so it matches without being told.
  return children ? (
    <ToastBarContext.Provider value={context}>
      {children({ toast: resolved, theme: bar.theme })}
    </ToastBarContext.Provider>
  ) : (
    <ToastBar toast={resolved} {...bar} />
  );
});

/**
 * The blur setting, kept as the same object while its component and props are
 * unchanged, so an inline `blur={{ … }}` does not re-render every toast. Props
 * compare shallowly: a `blurTarget` ref is the same object from render to render.
 */
function useStableBlur(blur: ToastBlur | undefined): ToastBlur | undefined {
  const ref = React.useRef(blur);
  const prev = ref.current;
  const same =
    prev === blur ||
    (prev !== undefined &&
      blur !== undefined &&
      prev.component === blur.component &&
      shallowSame(prev.props, blur.props));
  if (!same) ref.current = blur;
  return ref.current;
}

function shallowSame(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
}

/** A value-based key for a glass setting, so an equal object counts as unchanged. */
function glassKey(glass: boolean | GlassConfig): string {
  return typeof glass === 'object' ? JSON.stringify(glass) : String(glass);
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

/**
 * The haptic a toast plays: its own choice, else the Toaster's map or switch,
 * else its type's default. `false` at the toast, or at the Toaster when the
 * toast has not asked, plays nothing.
 */
function hapticFor(t: Toast, toaster: ToasterProps['haptics']): ToastHaptic | undefined {
  if (t.haptics === false) return undefined;
  if (typeof t.haptics === 'string') return t.haptics;
  if (t.haptics !== true && toaster === false) return undefined;
  const map = typeof toaster === 'object' ? toaster : undefined;
  return map && t.type in map ? map[t.type] : DEFAULT_HAPTICS[t.type];
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
  // A HUD's stack fills the screen and centres it.
  center: {
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  stack: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Set per stack from `offset`, so an edge-anchored toast keeps the same
    // inset from the side as from the top or bottom.
  },
});