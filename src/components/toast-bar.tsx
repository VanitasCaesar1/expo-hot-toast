import * as React from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { DismissReason, SwipeDirection, Toast, ToastBlur, ToastSlot, ToastTheme, ToastType } from '../core/types';
import { resolveValue } from '../core/store';
import { defaultTheme, mergeTheme } from '../core/defaults';
import { resolvePreset, resolveVariant, variantMotion, variantTheme } from '../core/presets';
import type { ToasterPreset } from '../core/presets';
import { progressValue, setProgress } from '../core/progress';
import { bolder, useBoldText } from '../utils/a11y';
import { withAlpha } from '../utils/color';
import { Avatar, Chevron, CountBadge, CountdownRing, ProgressBar, ProgressPercent, ProgressRing } from './parts';
import { toast as toastApi } from '../core/toast';
import { GlassSurface, GLASS_SUPPORTED } from './glass-surface';
import { ToastIcon, CloseIcon } from './icons';
import type { ToastIconKind } from './icons';

/**
 * What the Toaster resolves for one toast, beyond the toast itself.
 *
 * One shape for both paths: the Toaster spreads it into the built-in bar and
 * provides it through `ToastBarContext` to a bar rendered by the `<Toaster>`
 * render prop, so the two cannot drift apart.
 */
export interface ToastBarContextValue {
  /** The Toaster theme with the toast's own `theme` already merged in. */
  theme: ToastTheme;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  colorScheme?: 'light' | 'dark';
  atTop: boolean;
  reverseOrder: boolean;
  panThreshold: number;
  onDismiss: (id: string, reason: DismissReason) => void;
  onPressIn: () => void;
  onPressOut: () => void;
  /** Where a `stacked` Toaster places this toast. Absent otherwise. */
  stack?: StackPlacement;
  /** Reports the toast's measured height, which a `stacked` Toaster needs. */
  onMeasure?: (id: string, height: number) => void;
  /** The Toaster's preset, which picks the shape of `variant: 'auto'` toasts. */
  preset?: Exclude<ToasterPreset, 'auto'>;
  /** The Toaster's icon set, used for any type whose toast names no icon. */
  icons?: ToastIcons;
  /** True while the Toaster's timers are paused, for the Undo countdown. */
  paused?: boolean;
  /** Extra top or bottom padding for a banner against the screen edge: the safe-area inset. */
  edgeInset?: number;
  /** The Toaster's blur view, for platforms without glass or frost. */
  blur?: ToastBlur;
}

/** Icons for each type, and the close button, replacing the built-in glyphs. */
export type ToastIcons = Partial<Record<Exclude<ToastType, 'custom'> | 'close', React.ReactNode>>;

/**
 * A toast's place in a collapsed stack, computed by the Toaster.
 */
export interface StackPlacement {
  /** Distance from the front of the stack, 0 for the newest toast. */
  depth: number;
  /** Vertical offset that tucks it behind the toasts in front, in px. */
  shift: number;
  scale: number;
  /** True for toasts behind the front one while collapsed: only their edge shows. */
  hidden: boolean;
}

/**
 * Provided per toast by the Toaster. Lets `<ToastBar toast={t} />` inside the
 * Toaster's render prop work with no other props, as in react-hot-toast.
 */
export const ToastBarContext = React.createContext<ToastBarContextValue | null>(null);

/**
 * Every prop except `toast` is optional. An explicit prop wins over the
 * Toaster's value from context, which wins over the standalone default.
 */
export interface ToastBarProps {
  toast: Toast;
  /** Default: the Toaster's theme for this toast, else `defaultTheme`. */
  theme?: ToastTheme;
  /** True when the user has Reduce Transparency on. Forces the opaque surface. */
  reduceTransparency?: boolean;
  /** Forces the glass appearance to match tokens forced by the Toaster. */
  colorScheme?: 'light' | 'dark';
  /**
   * True when the user has Reduce Motion on. The built-in icon then renders in
   * its final state: no pop, no draw-in.
   */
  reduceMotion?: boolean;
  /**
   * True when the stack is anchored to the top; flips the travel direction.
   * Default: from `toast.resolvedPosition`.
   */
  atTop?: boolean;
  /** Default false. */
  reverseOrder?: boolean;
  /**
   * Fired with the reason whenever the toast is dismissed. Default: dismisses
   * this toast in its Toaster.
   */
  onDismiss?: (id: string, reason: DismissReason) => void;
  /** Press handlers pause and resume the Toaster's timers. Default: no-ops. */
  onPressIn?: () => void;
  onPressOut?: () => void;
  /** Drag-to-dismiss threshold in px. 0 disables the gesture. Default 72. */
  panThreshold?: number;
  /** Set by a `stacked` Toaster. */
  stack?: StackPlacement;
  /** Set by a `stacked` Toaster. */
  onMeasure?: (id: string, height: number) => void;
  /** Default: the Toaster's, else the platform's (`material` on Android, `glass` elsewhere). */
  preset?: Exclude<ToasterPreset, 'auto'>;
  /** Default: the Toaster's icon set. */
  icons?: ToastIcons;
  /** Default: the Toaster's blur view. */
  blur?: ToastBlur;
  /** True while the Toaster's timers are paused. Default: the Toaster's. */
  paused?: boolean;
  /** Extra padding against the screen edge, for a banner. Default: the Toaster's. */
  edgeInset?: number;
  children?: (props: {
    icon: React.ReactNode;
    message: React.ReactNode;
    /** The `description` option, or undefined. */
    description?: React.ReactNode;
  }) => React.ReactNode;
}

/** Used as the travel reference before onLayout has reported a real height. */
const ASSUMED_HEIGHT = 56;

/** rht pops its icon in from 0.6. */
const ICON_POP_FROM_SCALE = 0.6;

const noop = () => {};

/** Below Android's 8dp touch slop, so a toast's drag wins over a scroll view behind it. */
const ANDROID_SLOP = 6;

export const ToastBar = React.memo(function ToastBar({
  toast,
  theme: themeProp,
  reduceTransparency: reduceTransparencyProp,
  colorScheme: colorSchemeProp,
  reduceMotion: reduceMotionProp,
  atTop: atTopProp,
  reverseOrder: reverseOrderProp,
  onDismiss: onDismissProp,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  panThreshold: panThresholdProp,
  stack: stackProp,
  onMeasure: onMeasureProp,
  preset: presetProp,
  icons: iconsProp,
  blur: blurProp,
  paused: pausedProp,
  edgeInset: edgeInsetProp,
  children,
}: ToastBarProps) {
  const slot = React.useContext(ToastBarContext);

  // The shape: a toast asking for 'auto' takes the preset's (a pill, or a
  // Material snackbar), and each shape lays its own tokens and motion over the
  // Toaster's theme.
  const preset = presetProp ?? slot?.preset ?? resolvePreset('auto');
  const variant = resolveVariant(toast.variant, preset);
  const toasterTheme = themeProp ?? slot?.theme ?? defaultTheme;
  const reduceMotion = reduceMotionProp ?? slot?.reduceMotion ?? false;
  const baseTheme = React.useMemo(() => {
    const tokens = variantTheme(variant);
    // Reduce Motion has already zeroed travel and scale; a shape must not
    // bring them back.
    const motion = reduceMotion ? undefined : variantMotion(variant);
    return tokens || motion ? mergeTheme(toasterTheme, { ...tokens, motion }) : toasterTheme;
  }, [toasterTheme, variant, reduceMotion]);
  const icons = iconsProp ?? slot?.icons;
  const blur = blurProp ?? slot?.blur;
  const paused = pausedProp ?? slot?.paused ?? false;
  const edgeInset = edgeInsetProp ?? slot?.edgeInset ?? 0;
  const unstyled = toast.unstyled === true;
  const boldText = useBoldText();
  // `richColors` recolours success and error toasts by outcome: the surface,
  // its border and the text take the outcome palette, and glass takes a tint.
  const rich =
    toast.richColors &&
    (toast.type === 'success' || toast.type === 'error' || toast.type === 'info' || toast.type === 'warning')
      ? baseTheme.rich[toast.type]
      : undefined;
  const theme = React.useMemo(
    () =>
      rich
        ? {
            ...baseTheme,
            fallbackBackground: rich.background,
            border: rich.border,
            color: rich.color,
            descriptionColor: rich.color,
          }
        : baseTheme,
    [baseTheme, rich],
  );
  const glassConfig = typeof toast.glass === 'object' ? toast.glass : undefined;
  // The island is black in either appearance, like the Dynamic Island, so it
  // never draws glass.
  const glass =
    variant === 'island'
      ? false
      : rich && toast.glass !== false
        ? { ...glassConfig, tintColor: glassConfig?.tintColor ?? rich.tint }
        : toast.glass;
  const reduceTransparency = reduceTransparencyProp ?? slot?.reduceTransparency ?? false;
  // Liquid Glass cannot fade: UIKit drops the effect at an opacity near zero
  // and never puts it back, so it dematerializes instead. Every other surface,
  // frosted on the web or opaque, fades with the content. Without that, the
  // text left first and an empty pill shrank away for the rest of the exit.
  const onLiquidGlass =
    GLASS_SUPPORTED &&
    glass !== false &&
    !(typeof glass === 'object' && glass.style === 'none') &&
    !reduceTransparency;
  const colorScheme = colorSchemeProp ?? slot?.colorScheme;
  const atTop = atTopProp ?? slot?.atTop ?? toast.resolvedPosition.startsWith('top');
  const reverseOrder = reverseOrderProp ?? slot?.reverseOrder ?? false;
  const panThreshold = panThresholdProp ?? slot?.panThreshold ?? 72;
  const onPressIn = onPressInProp ?? slot?.onPressIn ?? noop;
  const onPressOut = onPressOutProp ?? slot?.onPressOut ?? noop;
  const stack = stackProp ?? slot?.stack;
  const onMeasure = onMeasureProp ?? slot?.onMeasure;
  const onDismiss =
    onDismissProp ??
    slot?.onDismiss ??
    ((id: string, reason: DismissReason) => toastApi.dismiss(id, toast.toasterId, reason));

  const { motion } = theme;

  const dragX = useSharedValue(0);
  // Written by the pan handler on the UI thread, read when the exit starts, so
  // a hard fling gets a proportionally shorter exit.
  const fling = useSharedValue(0);
  // Measured height feeds the enter and exit travel. A shared value so the
  // animated style reads it on the UI thread without a re-render.
  const height = useSharedValue(ASSUMED_HEIGHT);
  // 0 = off screen, 1 = settled. One clock for travel, scale and the content
  // fade, so enter and exit read as one motion rather than three.
  const presence = useSharedValue(0);
  // Vertical drag, toward the toast's own edge: up for a top toast, down for a
  // bottom one, the way a notification is flicked away.
  const dragY = useSharedValue(0);
  // Which axis the current drag locked to: 0 undecided, 1 sideways, 2 vertical.
  const dragAxis = useSharedValue(0);
  // A collapsed stack tucks this toast behind the ones in front of it. Both
  // values ease to each new placement on the queue-shift clock.
  const stackShift = stack?.shift ?? 0;
  const stackScale = stack?.scale ?? 1;
  const stackY = useSharedValue(stackShift);
  const stackS = useSharedValue(stackScale);

  // Toward the anchored edge: up for a top toast, down for a bottom one.
  //
  // Declared before the gesture chain on purpose, as are the flags below. The
  // Reanimated Babel plugin captures each callback's closure at the
  // `.onUpdate()` call site, and block-scoping lowers these `const`s to `var`s;
  // read after that point they are `undefined`, every comparison becomes NaN,
  // and the elastic-resistance branch silently never runs.
  const edgeSign = atTop ? -1 : 1;
  // Which way a swipe may dismiss. By default: sideways toward the reading
  // end (right, or left in a right-to-left layout), and toward the toast's own
  // edge. Same closure reason again for declaring them here.
  const dismissible = toast.dismissible !== false;
  // A Material snackbar is swiped sideways, either way, as Material 3 has it;
  // everything else toward its edge, and toward the end of the line.
  const directions: SwipeDirection[] =
    toast.swipeDirections ??
    (variant === 'snackbar' ? ['left', 'right'] : [I18nManager.isRTL ? 'left' : 'right', atTop ? 'up' : 'down']);
  const allowRight = directions.includes('right');
  const allowLeft = directions.includes('left');
  const allowEdge = directions.includes(atTop ? 'up' : 'down');
  const allowAway = directions.includes(atTop ? 'down' : 'up');

  // Travel always points away from the stack's anchor: a top-anchored toast
  // enters from above, a bottom-anchored one rises from below. rht does this
  // with a sign flip threaded through three separate calculations; inverting
  // once here keeps it honest.
  const direction = (atTop ? -1 : 1) * (reverseOrder ? -1 : 1);
  const isVisible = toast.visible;

  // Each wrapper is full width, so the toast's own horizontal alignment has to
  // follow its position. Always centring it put top-left and top-right toasts in
  // the middle of the screen.
  const placement = toast.position ?? toast.resolvedPosition;
  const align = placement.endsWith('left')
    ? 'flex-start'
    : placement.endsWith('right')
      ? 'flex-end'
      : 'center';

  // Drives `presence` from the store's `visible` flag. The exit therefore plays
  // during the store's exit window, while the toast is still mounted — rather
  // than in an `exiting` builder after removal, which held an empty material on
  // screen for the whole window and then shrank it a second time.
  //
  // `fling` is read here, in the effect, never during render: Reanimated warns
  // (and may tear) when a shared value is read while React is rendering.
  //
  // `contentSettled` hands the content's opacity back to React once the enter
  // finishes; see `contentStyle` below for why.
  const [contentSettled, setContentSettled] = React.useState(false);
  React.useEffect(() => {
    if (isVisible) {
      presence.value = withTiming(
        1,
        { duration: motion.enter, easing: motion.enterEasing },
        (finished) => {
          if (finished) runOnJS(setContentSettled)(true);
        },
      );
    } else {
      setContentSettled(false);
      presence.value = withTiming(0, {
        duration: exitDurationFor(motion, fling.value),
        easing: motion.exitEasing,
      });
    }
  }, [isVisible, motion, presence, fling]);

  React.useEffect(() => {
    const config = { duration: motion.queueShift, easing: motion.enterEasing };
    stackY.value = withTiming(stackShift, config);
    stackS.value = withTiming(stackScale, config);
  }, [stackShift, stackScale, motion.queueShift, motion.enterEasing, stackY, stackS]);

  /**
   * TRANSFORM ONLY. No opacity here.
   *
   * This view is an ancestor of the glass material, and a Liquid Glass view
   * stops rendering at all when cumulative opacity on it or an ancestor reaches
   * zero. The fade therefore lives on `contentStyle` below, inside the glass.
   */
  const transformStyle = useAnimatedStyle(() => {
    // Enter and exit travel differently on purpose (see MotionConfig), so the
    // far end of the motion depends on which way it is going.
    const travel = isVisible ? motion.enterTranslate : motion.exitTranslate;
    const from = isVisible ? motion.enterScale : motion.exitScale;
    const p = presence.value;

    return {
      transform: [
        // The drag is horizontal, so it moves the toast horizontally. It was
        // previously applied to translateY, which slid the toast up and down
        // under a sideways finger.
        //
        // Not reset on dismissal either: a swiped toast is carried off screen
        // by the release handler, and zeroing the offset here snapped it back
        // to the centre for the length of the exit.
        { translateX: dragX.value },
        { translateY: direction * height.value * travel * (1 - p) + dragY.value + stackY.value },
        { scale: (from + (1 - from) * p) * stackS.value },
        { rotateZ: `${(dragX.value / 40) * 4}deg` },
      ],
    };
  });

  // The icon's own entrance, on its own clock: it pops after the toast has
  // started to settle, and again whenever the type changes in place.
  const iconPop = useSharedValue(reduceMotion ? 1 : 0);
  const { iconPop: iconPopMs, iconPopDelay, iconEasing } = motion;
  const toastType = toast.type;
  // Primitives rather than `motion`: the Toaster builds a new theme object every
  // render, which would restart the pop on every unrelated state change.
  const [iconSettled, setIconSettled] = React.useState(reduceMotion);
  React.useEffect(() => {
    if (reduceMotion) {
      iconPop.value = 1;
      setIconSettled(true);
      return;
    }
    // The exit fades the whole content; replaying the pop under it would be noise.
    if (!isVisible) return;
    setIconSettled(false);
    iconPop.value = 0;
    iconPop.value = withDelay(
      iconPopDelay,
      withTiming(1, { duration: iconPopMs, easing: iconEasing }, (finished) => {
        if (finished) runOnJS(setIconSettled)(true);
      }),
    );
  }, [isVisible, toastType, reduceMotion, iconPopMs, iconPopDelay, iconEasing, iconPop]);

  // Opacity is safe here, unlike on `transformStyle`: this wrapper sits inside
  // the content, not above the glass. Clamped because the easing overshoots.
  const iconPopStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(iconPop.value, 0), 1),
    transform: [{ scale: ICON_POP_FROM_SCALE + (1 - ICON_POP_FROM_SCALE) * iconPop.value }],
  }));

  // Clamped because the enter curve overshoots: content may not exceed full
  // opacity while the material settles.
  //
  // Applied only while an enter or exit is running. React rendered this view
  // with the style's first value, opacity 0, and on Android (Reanimated 4.5 on
  // Fabric) a later commit could put that value back after the animation had
  // finished: a promise toast that had been loading for a few seconds resolved
  // to an empty pill, its text laid out but drawn at opacity 0. With the style
  // removed once settled, React's props carry the settled state themselves.
  // The icon pop's style is handed back the same way.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(presence.value, 0), 1),
  }));

  /**
   * Drag physics.
   *
   * Two details worth keeping. Dragging *against* the toast's dismissal
   * direction resists elastically rather than dismissing — a top-anchored toast
   * dragged upward is pushing it back toward where it came from, and letting
   * that count as a dismiss makes the gesture feel broken. And the fling velocity
   * is retained so the exit can be shortened in proportion: a hard throw should
   * not sit through the full 400ms deceleration after the finger has already let
   * go.
   */
  // The gesture must survive re-renders. Touching a toast pauses the queue and
  // the pan activating cancels that press, and each of those re-renders the
  // bar; a fresh `Gesture.Pan()` per render was re-attached mid-drag, which on
  // Android cancelled the drag and snapped the toast back. So the gesture is
  // memoized on stable inputs, and the dismissal goes through a ref because
  // the Toaster passes a new `onDismiss` on every render.
  const onDismissRef = React.useRef(onDismiss);
  React.useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  });
  const toastId = toast.id;
  const swipeAway = React.useCallback(() => {
    onDismissRef.current(toastId, 'swipe');
  }, [toastId]);

  const exitMs = motion.exit;
  const { exitEasing, enterEasing } = motion;

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(panThreshold > 0 && dismissible)
        // On Android a native ScrollView behind the toast also bids for the
        // drag, and it activates at the system touch slop (8dp). A 12dp
        // threshold lost every vertical race there, so a swipe up or down
        // scrolled the screen instead. 6dp claims the drag first; it is still
        // well beyond the jitter of a tap.
        .activeOffsetX(Platform.OS === 'android' ? [-ANDROID_SLOP, ANDROID_SLOP] : [-12, 12])
        .activeOffsetY(Platform.OS === 'android' ? [-ANDROID_SLOP, ANDROID_SLOP] : [-12, 12])
        .onStart(() => {
          dragAxis.value = 0;
        })
        .onUpdate((event) => {
          // The drag locks to whichever axis it starts along, so a sideways
          // swipe never drifts vertically and a flick up never slides sideways.
          if (dragAxis.value === 0) {
            dragAxis.value = Math.abs(event.translationX) >= Math.abs(event.translationY) ? 1 : 2;
          }
          if (dragAxis.value === 1) {
            dragX.value = resistUnless(event.translationX, allowRight, allowLeft);
          } else {
            dragY.value = resistUnless(event.translationY, edgeSign > 0 ? allowEdge : allowAway, edgeSign > 0 ? allowAway : allowEdge);
          }
        })
        .onEnd((event) => {
          if (dragAxis.value === 2) {
            // A toast is short, so the vertical distance is shorter too: about
            // two thirds of its own height, or a flick in an allowed direction.
            const travel = resistUnless(event.translationY, edgeSign > 0 ? allowEdge : allowAway, edgeSign > 0 ? allowAway : allowEdge);
            dragY.value = travel;
            const sign = Math.sign(travel || event.velocityY);
            const allowed = sign === edgeSign ? allowEdge : allowAway;
            const farEnough = allowed && Math.abs(travel) > Math.min(panThreshold, 44);
            const fastEnough = allowed && event.velocityY * sign > 600;
            fling.value = Math.abs(event.velocityY);
            if (farEnough || fastEnough) {
              const speed = Math.min(Math.abs(event.velocityY) / 1800, 1);
              dragY.value = withTiming(travel + sign * (height.value + 160), {
                duration: exitMs * (1 - 0.25 * speed),
                easing: exitEasing,
              });
              runOnJS(swipeAway)();
            } else {
              dragY.value = withTiming(0, { duration: 200, easing: enterEasing });
            }
            return;
          }

          // Judged on the release event's own translation, not the last
          // update's. A quick swipe can deliver only a few updates before the
          // finger lifts (on Android, three updates reached 18px of a 135px
          // swipe), and reading `dragX` dismissed nothing and snapped it back.
          const travel = resistUnless(event.translationX, allowRight, allowLeft);
          dragX.value = travel;
          const sign = Math.sign(travel || event.velocityX);
          const allowed = sign > 0 ? allowRight : allowLeft;
          const farEnough = allowed && Math.abs(travel) > panThreshold;
          const fastEnough = allowed && Math.abs(event.velocityX) > 900 && Math.sign(event.velocityX) === sign;

          fling.value = Math.abs(event.velocityX);

          if (farEnough || fastEnough) {
            // Carry the toast off screen from where the finger left it.
            // Assigned directly, the 500px jump happened in a single frame, so
            // a swiped toast teleported instead of leaving.
            const speed = Math.min(Math.abs(event.velocityX) / 1800, 1);
            dragX.value = withTiming(
              travel + (sign || 1) * 500,
              { duration: exitMs * (1 - 0.25 * speed), easing: exitEasing },
            );
            // Gesture callbacks run on the UI thread; the dismissal lives in
            // the JS store, so it has to hop threads explicitly.
            runOnJS(swipeAway)();
          } else {
            dragX.value = withTiming(0, { duration: 200, easing: enterEasing });
          }
        }),
    [panThreshold, dismissible, allowRight, allowLeft, allowEdge, allowAway, dragX, dragY, dragAxis, edgeSign, height, fling, exitMs, exitEasing, enterEasing, swipeAway],
  );

  // A per-toast `style.borderRadius` wins over the token, same as for the
  // wrapper it is applied to.
  const surfaceRadius =
    (StyleSheet.flatten(toast.style)?.borderRadius as number | undefined) ?? theme.radius;

  const message = resolveValue(toast.message, toast);
  const description = toast.description;
  // What a grouped toast reads aloud: the message, then the description.
  const spokenText =
    [
      extractText(message),
      description == null ? undefined : extractText(description),
      // The ×3 badge is for the eye; the grouped toast reads the count.
      toast.count && toast.count > 1 ? `${toast.count} times` : undefined,
    ]
      .filter(Boolean)
      .join('. ') || undefined;
  const iconKind = toast.type as ToastIconKind;

  // Per-part styles and class names. A class name rides on `className`, which
  // NativeWind and Uniwind read on React Native components; without one of
  // them it is ignored.
  const slotStyle = (part: ToastSlot): StyleProp<ViewStyle & TextStyle> => toast.styles?.[part];
  const slotClass = (part: ToastSlot): object | null => {
    const className = toast.classNames?.[part];
    return className ? { className } : null;
  };

  // Text weight follows Bold Text, as system text does.
  const titleWeight = boldText ? bolder(theme.fontWeight) : theme.fontWeight;
  const actionWeight = boldText ? '800' : '600';

  // A function icon receives the resolved toast, same as a function message.
  // Resolving only the message and passing the raw icon through would render
  // an invalid element type the moment anyone passed a function.
  const resolvedIcon =
    toast.icon === undefined ? undefined : resolveValue(toast.icon, toast);
  // The Toaster's icon set stands in for the built-in glyph of its type.
  const setIcon = toast.type === 'custom' ? undefined : icons?.[toast.type];

  // Progress: the toast's own value is written to the shared value the bar and
  // ring read; `toast.progress()` writes to it directly and skips React.
  const hasProgress = toast.progress !== undefined;
  const progress = hasProgress ? progressValue(toast.id) : undefined;
  const ownProgress = toast.progress;
  React.useEffect(() => {
    if (ownProgress !== undefined) setProgress(toastId, ownProgress);
  }, [ownProgress, toastId]);
  const ring = hasProgress && toast.progressStyle === 'ring';

  // A blank toast with no icon draws no icon slot at all. An empty slot still
  // took the row gap, so plain toasts sat off-centre in their pill.
  const hasGlyph =
    iconKind === 'success' ||
    iconKind === 'error' ||
    iconKind === 'loading' ||
    iconKind === 'info' ||
    iconKind === 'warning';
  // A progress bar says "working" already; a spinner beside it would repeat it.
  const hideSpinner = hasProgress && !ring && iconKind === 'loading';
  const iconSize = theme.iconSize;
  const glyph =
    resolvedIcon ??
    setIcon ??
    (hideSpinner ? null : (
      <ToastIcon
        kind={iconKind}
        size={iconSize}
        theme={theme}
        iconTheme={toast.iconTheme}
        reduceMotion={reduceMotion}
      />
    ));
  const accent = toast.iconTheme?.primary ?? (rich ? rich.color : theme.actionColor);
  // `icon: null` hides the icon, glyph included, as in react-hot-toast.
  const showIcon = !(toast.icon === null || (resolvedIcon == null && setIcon == null && (!hasGlyph || hideSpinner)));
  const defaultIcon = toast.avatar !== undefined ? (
    <Avatar avatar={toast.avatar} size={variant === 'card' ? 40 : 28} style={slotStyle('avatar') as StyleProp<ViewStyle>} />
  ) : ring ? (
    <ProgressRing
      progress={progress!}
      size={iconSize + 4}
      color={accent}
      trackColor={withAlpha(theme.color, 0.16)}
      reduceMotion={reduceMotion}
    />
  ) : !showIcon ? null : (
    <Animated.View
      style={[styles.icon, toast.iconStyle, slotStyle('icon') as StyleProp<ViewStyle>, iconSettled ? null : iconPopStyle]}
      {...slotClass('icon')}
    >
      {glyph}
    </Animated.View>
  );

  const tapToDismiss = dismissible && (toast.dismissOnTap ?? Platform.OS === 'android');
  const closeable = dismissible && (toast.closeButton ?? toast.closeable ?? false);
  const expandable = toast.expandable;
  const [expanded, setExpanded] = React.useState(expandable?.defaultExpanded ?? false);
  // An open toast holds the queue, so the details stay as long as they are
  // being read. Closing it, or the toast leaving while open, lets the timers
  // run again.
  const pauseRef = React.useRef({ onPressIn, onPressOut });
  pauseRef.current = { onPressIn, onPressOut };
  React.useEffect(() => {
    if (!expanded) return undefined;
    pauseRef.current.onPressIn();
    return () => pauseRef.current.onPressOut();
  }, [expanded]);
  const hasButtons = closeable || toast.action !== undefined || toast.cancel !== undefined || expandable !== undefined;
  // Errors interrupt; everything else queues politely. This is the one place
  // the flag actually reaches Android, which has real live regions.
  const assertive = toast.important ?? toast.type === 'error';
  const hud = variant === 'hud';

  const messageText = (
    <Text
      style={[
        styles.message,
        // A class on the title takes the place of the token text styles: in
        // React Native an inline style beats a class, so keeping them would
        // silently override text-xl or font-bold. `style` still wins.
        toast.classNames?.title
          ? null
          : {
              color: theme.color,
              fontSize: theme.fontSize,
              lineHeight: theme.lineHeight,
              fontWeight: titleWeight,
              fontFamily: theme.fontFamily,
            },
        hud && styles.centered,
        toast.textStyle,
        slotStyle('title') as StyleProp<TextStyle>,
      ]}
      {...slotClass('title')}
      numberOfLines={theme.maxLines}
      // Android's default "highQuality" break strategy can measure a line a
      // fraction narrower than it draws it, so the last word wraps onto a line
      // the measured height has no room for (a HUD showed "Added to").
      textBreakStrategy="simple"
      // Ungrouped toasts read the message on its own, so a custom label
      // belongs here instead of on the container.
      accessibilityLabel={hasButtons ? toast.accessibilityLabel : undefined}
      maxFontSizeMultiplier={theme.maxFontSizeMultiplier ?? undefined}
    >
      {message}
    </Text>
  );

  const muted = withAlpha(theme.color, 0.55);
  // The title line: the message, a repeat count, and a time or step label.
  const titleLine =
    (toast.count ?? 1) > 1 || toast.timestamp !== undefined || hasProgress ? (
      <View style={[styles.titleLine, hud && styles.centeredRow]}>
        {messageText}
        {(toast.count ?? 1) > 1 ? (
          <CountBadge
            count={toast.count!}
            color={theme.color}
            background={withAlpha(theme.color, 0.12)}
            style={slotStyle('badge') as StyleProp<ViewStyle>}
          />
        ) : null}
        {toast.timestamp !== undefined ? (
          <Text
            style={[styles.timestamp, { color: muted, fontFamily: theme.descriptionFontFamily ?? theme.fontFamily }, slotStyle('timestamp') as StyleProp<TextStyle>]}
            {...slotClass('timestamp')}
            maxFontSizeMultiplier={theme.maxFontSizeMultiplier ?? undefined}
          >
            {toast.timestamp}
          </Text>
        ) : null}
        {hasProgress && !hud ? (
          <ProgressPercent progress={progress!} style={[styles.timestamp, { color: muted, fontSize: theme.descriptionFontSize }]} />
        ) : null}
      </View>
    ) : (
      messageText
    );

  const descriptionNode =
    description == null ? null : typeof description === 'string' || typeof description === 'number' ? (
      <Text
        style={[
          toast.classNames?.description
            ? null
            : {
                color: theme.descriptionColor,
                fontSize: theme.descriptionFontSize,
                lineHeight: theme.descriptionLineHeight,
                fontFamily: theme.descriptionFontFamily ?? theme.fontFamily,
              },
          hud && styles.centered,
          slotStyle('description') as StyleProp<TextStyle>,
        ]}
        {...slotClass('description')}
        numberOfLines={theme.descriptionMaxLines}
        textBreakStrategy="simple"
        maxFontSizeMultiplier={theme.maxFontSizeMultiplier ?? undefined}
      >
        {description}
      </Text>
    ) : (
      description
    );

  const texts =
    descriptionNode == null && titleLine === messageText ? (
      messageText
    ) : (
      <View style={[styles.texts, hud && styles.centeredColumn]}>
        {titleLine}
        {descriptionNode}
      </View>
    );

  const button = (
    kind: 'action' | 'cancel',
    spec: NonNullable<Toast['action']>,
  ) => (
    <Pressable
      key={kind}
      onPress={() => {
        spec.onPress();
        // Dismiss after the handler, not before: an Undo that reverses state
        // should leave before the toast does, so the queue never shows a
        // message describing something that no longer happened.
        onDismiss(toast.id, 'action' as DismissReason);
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={spec.label}
      style={({ pressed }) => [
        styles.action,
        { paddingHorizontal: theme.actionPaddingHorizontal },
        kind === 'cancel' && { backgroundColor: withAlpha(theme.color, 0.08) },
        pressed && styles.actionPressed,
        slotStyle(kind) as StyleProp<ViewStyle>,
      ]}
      {...slotClass(kind)}
    >
      <View style={styles.actionInner}>
        {kind === 'action' && spec.countdown && Number.isFinite(toast.duration) ? (
          <CountdownRing
            remaining={Math.max((toast.duration ?? 0) + toast.pauseDuration - (Date.now() - toast.createdAt), 0)}
            total={toast.duration ?? 0}
            paused={paused}
            size={16}
            color={spec.color ?? theme.actionColor}
          />
        ) : null}
        <Text
          maxFontSizeMultiplier={theme.maxFontSizeMultiplier ?? undefined}
          style={[
            styles.actionLabel as TextStyle,
            {
              color: kind === 'cancel' ? theme.color : (spec.color ?? theme.actionColor),
              fontSize: theme.fontSize,
              fontWeight: kind === 'cancel' ? titleWeight : actionWeight,
              fontFamily: theme.actionFontFamily ?? theme.fontFamily,
            },
            slotStyle(kind === 'cancel' ? 'cancelLabel' : 'actionLabel') as StyleProp<TextStyle>,
          ]}
          {...slotClass(kind === 'cancel' ? 'cancelLabel' : 'actionLabel')}
        >
          {spec.label}
        </Text>
      </View>
    </Pressable>
  );

  const toggle = expandable ? (
    <Pressable
      key="expand"
      onPress={() => setExpanded((open) => !open)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expandable.label ?? (expanded ? 'Hide details' : 'Show details')}
      style={({ pressed }) => [styles.close, { backgroundColor: theme.closeButtonBackground }, pressed && styles.closePressed]}
    >
      <Chevron open={expanded} color={theme.color} />
    </Pressable>
  ) : null;

  const close = closeable ? (
    <Pressable
      key="close"
      onPress={() => onDismiss(toast.id, 'close')}
      // 28pt is the smallest comfortable target; below that the button is
      // technically hittable and practically unusable.
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Dismiss"
      style={({ pressed }) => [
        styles.close,
        // A backdrop is what makes a 14pt glyph legible on a moving,
        // translucent material; without it the cross reads as a smudge.
        { backgroundColor: theme.closeButtonBackground },
        pressed && styles.closePressed,
        slotStyle('closeButton') as StyleProp<ViewStyle>,
      ]}
      {...slotClass('closeButton')}
    >
      {icons?.close ?? <CloseIcon size={15} color={toast.closeButtonColor ?? theme.color} />}
    </Pressable>
  ) : null;

  const buttons = [
    toggle,
    toast.cancel ? button('cancel', toast.cancel) : null,
    toast.action ? button('action', toast.action) : null,
    close,
  ];

  const row = hud ? (
    // A HUD stacks: the icon above the text, and any buttons under both.
    <View style={[styles.hud, slotStyle('content') as StyleProp<ViewStyle>]} {...slotClass('content')}>
      {defaultIcon}
      {texts}
      {buttons.some(Boolean) ? <View style={styles.hudButtons}>{buttons}</View> : null}
    </View>
  ) : (
    <View style={[styles.row, slotStyle('content') as StyleProp<ViewStyle>]} {...slotClass('content')}>
      {defaultIcon}
      {texts}
      {buttons}
    </View>
  );

  const expandedContent =
    expandable && expanded ? (
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(220)}
        exiting={reduceMotion ? undefined : FadeOut.duration(160)}
        style={[styles.expanded, { borderTopColor: withAlpha(theme.color, 0.12) }, slotStyle('expanded') as StyleProp<ViewStyle>]}
        {...slotClass('expanded')}
      >
        {typeof expandable.content === 'string' ? (
          <Text
            style={{ color: theme.descriptionColor, fontSize: theme.descriptionFontSize, lineHeight: theme.descriptionLineHeight, fontFamily: theme.descriptionFontFamily ?? theme.fontFamily }}
            maxFontSizeMultiplier={theme.maxFontSizeMultiplier ?? undefined}
          >
            {expandable.content}
          </Text>
        ) : (
          expandable.content
        )}
      </Animated.View>
    ) : null;

  const builtIn = expandable ? (
    <View style={styles.column}>
      {row}
      {expandedContent}
    </View>
  ) : (
    row
  );

  const content = children ? children({ icon: defaultIcon, message, description }) : builtIn;

  const progressBar =
    hasProgress && !ring && !hud ? (
      <ProgressBar
        progress={progress!}
        color={accent}
        trackColor={withAlpha(theme.color, 0.12)}
        segments={toast.progressSegments}
        reduceMotion={reduceMotion}
        style={[
          // Inset from the rounded corners, so the bar sits inside the shape.
          { left: Math.min(theme.radius * 0.6, 18), right: Math.min(theme.radius * 0.6, 18), bottom: 6, borderRadius: 2 },
          slotStyle('progressTrack') as StyleProp<ViewStyle>,
        ]}
        barStyle={slotStyle('progressBar') as StyleProp<ViewStyle>}
      />
    ) : hasProgress && hud && !ring ? (
      <ProgressBar
        progress={progress!}
        color={accent}
        trackColor={withAlpha(theme.color, 0.12)}
        segments={toast.progressSegments}
        reduceMotion={reduceMotion}
        style={[{ left: 26, right: 26, bottom: 14, borderRadius: 2 }, slotStyle('progressTrack') as StyleProp<ViewStyle>]}
        barStyle={slotStyle('progressBar') as StyleProp<ViewStyle>}
      />
    ) : null;

  const surface = (
    <GlassSurface
      theme={theme}
      glass={glass}
      blur={blur}
      // The material carries its own corner radius. expo-glass-effect
      // reads `borderRadius` off the GlassView itself to configure
      // UIKit's corner shape; clipping a square glass view with a
      // rounded `overflow: hidden` parent instead cuts off the rim
      // highlight at every corner and stops neighbouring toasts in a
      // GlassContainer from merging.
      radius={surfaceRadius}
      // Must be threaded down from the Toaster. Without it the
      // Reduce Transparency rung is unreachable through the public
      // API, and a user who asked for no transparency still gets
      // glass — which is the exact failure the ladder exists to
      // prevent.
      reduceTransparency={reduceTransparency}
      // Glass cannot fade, so it materializes and dematerializes on
      // the same clock as everything else.
      visible={isVisible}
      colorScheme={colorScheme}
      enterDuration={motion.enter}
      exitDuration={motion.exit}
      style={StyleSheet.absoluteFill}
    />
  );

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        // The sibling push. When a toast above is dismissed or a new one
        // arrives, everything below glides instead of jumping. This replaces
        // react-hot-toast's measured-offset arithmetic entirely.
        layout={LinearTransition.duration(motion.queueShift).easing(
          motion.enterEasing,
        )}
        // In a stack the front toast draws over the ones tucked behind it.
        style={[styles.wrapper, { alignItems: align }, stack && { zIndex: 100 - stack.depth }]}
      >
        <Animated.View
          style={[
            styles.wrapper,
            { alignItems: align },
            // Scaled about the edge that peeks out, so it stays where the stack put it.
            stack && { transformOrigin: atTop ? 'bottom' : 'top' },
            transformStyle,
          ]}
        >
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={
              toast.onPress
                ? () => {
                    // A notification that opens something leaves once it has.
                    toast.onPress!();
                    onDismiss(toast.id, 'tap');
                  }
                : tapToDismiss
                  ? () => onDismiss(toast.id, 'tap')
                  : undefined
            }
            accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
            // One accessibility element reads the toast as a single alert, but
            // on iOS it also hides everything inside it: VoiceOver could not
            // reach an Undo or close button. Toasts with buttons stay
            // ungrouped, so the message and each button are reachable.
            accessible={!hasButtons}
            accessibilityRole={hasButtons ? undefined : 'alert'}
            accessibilityLabel={
              hasButtons ? undefined : (toast.accessibilityLabel ?? spokenText)
            }
            accessibilityHint={
              toast.onPress ? 'Double tap to open' : tapToDismiss && !hasButtons ? 'Double tap to dismiss' : undefined
            }
            style={[styles.pressable, { alignItems: align }]}
            onLayout={(event) => {
              height.value = event.nativeEvent.layout.height;
              onMeasure?.(toast.id, event.nativeEvent.layout.height);
            }}
          >
            <Animated.View
              // The surface glides to a new size when its content changes (a
              // loading toast becoming its outcome, details opening, a message
              // updated) instead of jumping. Its place in the stack is the
              // wrapper's to animate; this only moves within it.
              layout={reduceMotion ? undefined : LinearTransition.duration(motion.queueShift).easing(motion.enterEasing)}
              style={[
                styles.surfaceWrap,
                // Unstyled leaves the padding and corners out altogether rather
                // than zeroing them, so classes on the toast can set them.
                unstyled
                  ? { maxWidth: theme.maxWidth, gap: theme.gap }
                  : {
                      borderRadius: theme.radius,
                      // iOS renders a continuous corner curve as one smooth arc
                      // across adjoining corners; a plain borderRadius leaves a
                      // visible crease where they meet.
                      borderCurve: 'continuous',
                      paddingVertical: theme.paddingVertical,
                      paddingHorizontal: theme.paddingHorizontal,
                      maxWidth: theme.maxWidth,
                      gap: theme.gap,
                    },
                // A snackbar, banner or card stretches to the stack's width.
                theme.fill && styles.fill,
                // Room under a progress bar, so it never sits on the text.
                !unstyled && hasProgress && !ring && { paddingBottom: theme.paddingVertical + 6 },
                // A banner reaches under the status bar or home indicator.
                !unstyled && edgeInset > 0 && (atTop ? { paddingTop: theme.paddingVertical + edgeInset } : { paddingBottom: theme.paddingVertical + edgeInset }),
                // Applied last so a consumer's `style` can override any token,
                // which is the precedence the store's merge already assumes.
                toast.style,
                slotStyle('toast') as StyleProp<ViewStyle>,
              ]}
              {...slotClass('toast')}
            >
              {unstyled ? null : onLiquidGlass ? (
                surface
              ) : (
                // Off Liquid Glass, the surface takes the content's fade, handed
                // back once settled for the same reason as the content's.
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, contentSettled ? null : contentStyle]}
                >
                  {surface}
                </Animated.View>
              )}
              <Animated.View
                style={[styles.content, contentSettled ? null : contentStyle, stack?.hidden && styles.tucked]}
                importantForAccessibility={stack?.hidden ? 'no-hide-descendants' : undefined}
                accessibilityElementsHidden={stack?.hidden}
              >
                {content}
              </Animated.View>
              {progressBar}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

/**
 * Drag offset for a raw translation on one axis. A drag toward a direction
 * that does not dismiss resists elastically, so it never travels far enough to.
 */
function resistUnless(raw: number, allowPositive: boolean, allowNegative: boolean): number {
  'worklet';
  const allowed = raw >= 0 ? allowPositive : allowNegative;
  return allowed ? raw : raw * 0.35 * (1 / (1 + Math.abs(raw) * 0.02));
}

/**
 * Exit duration, shortened in proportion to the fling that caused it so the
 * toast keeps up with the gesture instead of drifting. 1800px/s is roughly a
 * deliberate flick and takes the full 25% off; nothing can take more.
 */
export function exitDurationFor(motion: ToastTheme['motion'], fling: number): number {
  const speed = Math.min(Math.abs(fling) / 1800, 1);
  return motion.exit * (1 - 0.25 * speed);
}

/** Best-effort label extraction so iOS has something to announce. */
function extractText(node: React.ReactNode): string | undefined {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    const parts = node.map(extractText).filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : undefined;
  }
  return undefined;
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  pressable: {
    width: '100%',
    alignItems: 'center',
  },
  surfaceWrap: {
    // Hugs its content, up to `maxWidth`, like react-hot-toast's pill. At full
    // width a two-word toast was a 340pt bar with the text pushed to one end.
    flexShrink: 1,
    // No `overflow: hidden`. Both rungs of GlassSurface round themselves, and
    // clipping here would cut the glass rim and any GlassContainer merge.
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Lets a long message wrap at the surface's maxWidth instead of pushing
    // the close and action buttons out of the toast.
    flexShrink: 1,
  },
  // Exists so `iconStyle` has something to attach to. Without this wrapper the
  // resolved style had nowhere to land and was silently discarded.
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Behind the front toast of a collapsed stack: the surface's edge shows, its
  // content does not.
  tucked: {
    opacity: 0,
  },
  // Message and description, stacked. Shrinks like the message does.
  texts: {
    flexShrink: 1,
    gap: 2,
  },
  message: {
    // Shrinks (wraps) rather than grows. A `flexGrow` here makes Yoga fill the
    // whole available width in an at-most layout, which defeated the hugging
    // surface and turned every toast into a full-width bar.
    flexShrink: 1,
  },
  close: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    // Never allow the row to squeeze the target away.
    flexShrink: 0,
    marginLeft: 2,
  },
  closePressed: {
    opacity: 0.5,
  },
  action: {
    flexShrink: 0,
    justifyContent: 'center',
    paddingVertical: 4,
    // A pill rather than a rectangle: an Undo button in the corner of a
    // translucent bar should read as part of the material, not as chrome on it.
    borderRadius: 999,
    borderCurve: 'continuous',
    marginLeft: 2,
  },
  actionPressed: {
    opacity: 0.55,
  },
  actionLabel: {
    fontWeight: '600',
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // The message with its count, time or percentage on one line.
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 6,
  },
  timestamp: {
    fontSize: 13,
    flexShrink: 0,
  },
  centered: {
    textAlign: 'center',
  },
  centeredRow: {
    justifyContent: 'center',
  },
  centeredColumn: {
    alignItems: 'center',
  },
  // The HUD's column: icon, text, buttons, centred.
  hud: {
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  hudButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  column: {
    flexShrink: 1,
  },
  // The expandable toast's details, under a hairline.
  expanded: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});