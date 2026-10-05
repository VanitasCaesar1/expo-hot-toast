import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { DismissReason, Toast, ToastTheme } from '../core/types';
import { resolveValue } from '../core/store';
import { GlassSurface } from './glass-surface';
import { ToastIcon, CloseIcon } from './icons';
import type { ToastIconKind } from './icons';

export interface ToastBarProps {
  toast: Toast;
  theme: ToastTheme;
  /** True when the user has Reduce Transparency on. Forces the opaque surface. */
  reduceTransparency?: boolean;
  /** True when the stack is anchored to the top; flips the travel direction. */
  atTop: boolean;
  reverseOrder: boolean;
  /** Fired with the reason whenever the toast is dismissed. */
  onDismiss: (id: string, reason: DismissReason) => void;
  onPressIn: () => void;
  onPressOut: () => void;
  /** Drag-to-dismiss threshold in px. 0 disables the gesture. */
  panThreshold: number;
  children?: (props: {
    icon: React.ReactNode;
    message: React.ReactNode;
  }) => React.ReactNode;
}

/** Used as the travel reference before onLayout has reported a real height. */
const ASSUMED_HEIGHT = 56;

export const ToastBar = React.memo(function ToastBar({
  toast,
  theme,
  reduceTransparency = false,
  atTop,
  reverseOrder,
  onDismiss,
  onPressIn,
  onPressOut,
  panThreshold,
  children,
}: ToastBarProps) {
  const { motion } = theme;

  // Measured height feeds the exit travel. A plain object rather than a shared
  // value because `exiting` builders read it on the UI thread at removal time,
  // and because it must not itself trigger a re-render.
  const measured = React.useRef(ASSUMED_HEIGHT);
  const dragX = useSharedValue(0);
  // Retained so the exiting worklet can shorten its duration in proportion to the
  // fling that caused it. A shared value because `exiting` builders run on the UI
  // thread and cannot read JS-thread state.
  const fling = useSharedValue(0);

  // Which horizontal direction dismisses. Either works, but only one should
  // count as "let go of me" — the other is a push-back.
  //
  // Declared before the gesture chain on purpose. The Reanimated Babel plugin
  // captures each callback's closure at the `.onUpdate()` call site, and
  // block-scoping lowers this `const` to a `var`; read after that point it is
  // `undefined`, every comparison becomes NaN, and the elastic-resistance branch
  // silently never runs.
  const dismissalSign = 1;

  // Travel always points away from the stack's anchor: a top-anchored toast
  // enters from above, a bottom-anchored one rises from below. rht does this
  // with a sign flip threaded through three separate calculations; inverting
  // once here keeps it honest.
  const direction = (atTop ? -1 : 1) * (reverseOrder ? -1 : 1);
  const isVisible = toast.visible;

  /**
   * TRANSFORM ONLY. No opacity here.
   *
   * This view is an ancestor of the glass material, and a Liquid Glass view
   * stops rendering at all when cumulative opacity on it or an ancestor reaches
   * zero. The fade therefore lives on `contentStyle` below, inside the glass.
   */
  const transformStyle = useAnimatedStyle(() => {
    if (!isVisible) {
      // Replaced wholesale by the `exiting` builder at removal time; this
      // branch only covers the dismiss -> removed window.
      return { transform: [{ translateY: 0 }, { scale: 1 }] };
    }

    return {
      transform: [
        { translateY: dragX.value === 0 ? 0 : dragX.value },
        { scale: withTiming(1, { duration: motion.enter, easing: motion.enterEasing }) },
        { rotateZ: `${(dragX.value / 40) * 4}deg` },
      ],
    };
  }, [isVisible, motion, dragX.value]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isVisible ? 1 : 0, {
      duration: isVisible ? motion.enter : motion.exit,
      easing: isVisible ? motion.enterEasing : motion.exitEasing,
    }),
  }), [isVisible, motion]);

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
  const pan = Gesture.Pan()
    .enabled(panThreshold > 0)
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      const raw = event.translationX;
      const wrongWay = raw * dismissalSign < 0;

      dragX.value = wrongWay
        ? raw * 0.35 * (1 / (1 + Math.abs(raw) * 0.02))
        : raw;
    })
    .onEnd((event) => {
      const farEnough = Math.abs(dragX.value) > panThreshold;
      const fastEnough = Math.abs(event.velocityX) > 900;

      fling.value = Math.abs(event.velocityX);

      if (farEnough || fastEnough) {
        // Park the toast just off screen so the exit animation picks up from
        // where the finger left it rather than snapping back to centre first.
        dragX.value =
          event.translationX + Math.sign(event.translationX || 1) * 500;
        onDismiss(toast.id, 'swipe');
      } else {
        dragX.value = withTiming(0, { duration: 200, easing: motion.enterEasing });
      }
    });

  const message = resolveValue(toast.message, toast);
  const iconKind = toast.type as ToastIconKind;

  // A function icon receives the resolved toast, same as a function message.
  // Resolving only the message and passing the raw icon through would render
  // an invalid element type the moment anyone passed a function.
  const resolvedIcon =
    toast.icon === undefined ? undefined : resolveValue(toast.icon, toast);

  const defaultIcon = (
    <View style={[styles.icon, toast.iconStyle]}>
      {resolvedIcon ?? (
        <ToastIcon kind={iconKind} size={theme.iconSize} theme={theme} />
      )}
    </View>
  );

  const tapToDismiss = toast.dismissOnTap ?? Platform.OS === 'android';
  const closeable = toast.closeButton ?? toast.closeable ?? false;
  // Errors interrupt; everything else queues politely. This is the one place
  // the flag actually reaches Android, which has real live regions.
  const assertive = toast.important ?? toast.type === 'error';

  const content = children ? (    children({ icon: defaultIcon, message })
  ) : (
    <View style={styles.row}>
      {defaultIcon}
      <Text
        style={[
          styles.message,
          {
            color: theme.color,
            fontSize: theme.fontSize,
            lineHeight: theme.lineHeight,
            fontWeight: theme.fontWeight,
          },
          toast.textStyle,
        ]}
        numberOfLines={3}
      >
        {message}
      </Text>
      {closeable ? (
        <Pressable
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
          ]}
        >
          <CloseIcon
            size={15}
            color={toast.closeButtonColor ?? theme.color}
          />
        </Pressable>
      ) : null}
      {toast.action ? (
        <Pressable
          onPress={() => {
            toast.action!.onPress();
            // Dismiss after the handler, not before: an Undo that reverses state
            // should leave before the toast does, so the queue never shows a
            // message describing something that no longer happened.
            onDismiss(toast.id, 'action' as DismissReason);
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
          style={({ pressed }) => [
            styles.action,
            { paddingHorizontal: theme.actionPaddingHorizontal },
            pressed && styles.actionPressed,
          ]}
        >
          <Text
            style={[
              styles.actionLabel as TextStyle,
              {
                color: toast.action.color ?? theme.actionColor,
                fontSize: theme.fontSize,
                fontWeight: '600',
              },
            ]}
          >
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
        exiting={buildExiting(motion, direction, measured, fling)}
        style={styles.wrapper}
      >
        <Animated.View style={[styles.wrapper, transformStyle]}>
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            onPress={
              tapToDismiss
                ? () => onDismiss(toast.id, 'tap')
                : undefined
            }
            accessibilityLiveRegion={assertive ? 'assertive' : 'polite'}
            accessibilityRole="alert"
            accessibilityLabel={toast.accessibilityLabel ?? extractText(message)}
            accessibilityHint={tapToDismiss ? 'Double tap to dismiss' : undefined}
            style={styles.pressable}
            onLayout={(event) => {
              measured.current = event.nativeEvent.layout.height;
            }}
          >
            <View
              style={[
                styles.surfaceWrap,
                {
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
                // Applied last so a consumer's `style` can override any token,
                // which is the precedence the store's merge already assumes.
                toast.style,
              ]}
            >
              <GlassSurface
                theme={theme}
                glass={toast.glass}
                // Must be threaded down from the Toaster. Without it the
                // Reduce Transparency rung is unreachable through the public
                // API, and a user who asked for no transparency still gets
                // glass — which is the exact failure the ladder exists to
                // prevent.
                reduceTransparency={reduceTransparency}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View entering={FadeIn.duration(motion.enter)} style={styles.content}>
                <Animated.View style={contentStyle}>{content}</Animated.View>
              </Animated.View>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

/**
 * Exit is authored as a builder so it can close over the live motion config, the
 * travel direction, and the measured height. A module-level constant could do
 * none of those, which is why a single shared `exiting` value is not enough.
 */
function buildExiting(
  motion: ToastTheme['motion'],
  direction: number,
  measured: React.RefObject<number>,
  fling: { value: number },
) {
  return () => {
    'worklet';
    const height = measured.current ?? ASSUMED_HEIGHT;

    // A hard fling gets a proportionally shorter exit, so the toast keeps up with
    // the gesture instead of drifting. 1800px/s is roughly a deliberate flick.
    const speed = Math.min(Math.abs(fling.value) / 1800, 1);
    const duration = motion.exit * (1 - 0.25 * speed);

    return {
      initialValues: { transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: {
        transform: [
          {
            translateY: withTiming(direction * height * motion.exitTranslate, {
              duration,
              easing: motion.exitEasing,
            }),
          },
          {
            scale: withTiming(motion.exitScale, {
              duration,
              easing: motion.exitEasing,
            }),
          },
        ],
      },
    };
  };
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
    width: '100%',
    // Clips the opaque fallback's corners. Real glass rounds itself.
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    // Without this the message claims the full intrinsic width and pushes the
    // close button past the surface's overflow-hidden edge, so it renders but
    // is invisible.
    width: '100%',
  },
  // Exists so `iconStyle` has something to attach to. Without this wrapper the
  // resolved style had nowhere to land and was silently discarded.
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexShrink: 1,
    // Absorbs the leftover width so the close button keeps its intrinsic size.
    flexGrow: 1,
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
});