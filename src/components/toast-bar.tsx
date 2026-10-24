import * as React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import Animated, {
  LinearTransition,
  runOnJS,
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
  /** Forces the glass appearance to match tokens forced by the Toaster. */
  colorScheme?: 'light' | 'dark';
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
  colorScheme,
  atTop,
  reverseOrder,
  onDismiss,
  onPressIn,
  onPressOut,
  panThreshold,
  children,
}: ToastBarProps) {
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
  React.useEffect(() => {
    presence.value = isVisible
      ? withTiming(1, { duration: motion.enter, easing: motion.enterEasing })
      : withTiming(0, {
          duration: exitDurationFor(motion, fling.value),
          easing: motion.exitEasing,
        });
  }, [isVisible, motion, presence, fling]);

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
        { translateY: direction * height.value * travel * (1 - p) },
        { scale: from + (1 - from) * p },
        { rotateZ: `${(dragX.value / 40) * 4}deg` },
      ],
    };
  });

  // Clamped because the enter curve overshoots: content may not exceed full
  // opacity while the material settles.
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
        // Carry the toast off screen from where the finger left it. Assigned
        // directly, the 500px jump happened in a single frame, so a swiped
        // toast teleported instead of leaving.
        const speed = Math.min(Math.abs(event.velocityX) / 1800, 1);
        dragX.value = withTiming(
          event.translationX + Math.sign(event.translationX || 1) * 500,
          { duration: motion.exit * (1 - 0.25 * speed), easing: motion.exitEasing },
        );
        // Gesture callbacks run on the UI thread; the dismissal lives in the JS
        // store, so it has to hop threads explicitly.
        runOnJS(onDismiss)(toast.id, 'swipe');
      } else {
        dragX.value = withTiming(0, { duration: 200, easing: motion.enterEasing });
      }
    });

  // A per-toast `style.borderRadius` wins over the token, same as for the
  // wrapper it is applied to.
  const surfaceRadius =
    (StyleSheet.flatten(toast.style)?.borderRadius as number | undefined) ?? theme.radius;

  const message = resolveValue(toast.message, toast);
  const iconKind = toast.type as ToastIconKind;

  // A function icon receives the resolved toast, same as a function message.
  // Resolving only the message and passing the raw icon through would render
  // an invalid element type the moment anyone passed a function.
  const resolvedIcon =
    toast.icon === undefined ? undefined : resolveValue(toast.icon, toast);

  // A blank toast with no icon draws no icon slot at all. An empty slot still
  // took the row gap, so plain toasts sat off-centre in their pill.
  const hasGlyph =
    iconKind === 'success' || iconKind === 'error' || iconKind === 'loading';
  const defaultIcon = resolvedIcon == null && !hasGlyph ? null : (
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

  const content = children ? (
    children({ icon: defaultIcon, message })
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
        style={[styles.wrapper, { alignItems: align }]}
      >
        <Animated.View style={[styles.wrapper, { alignItems: align }, transformStyle]}>
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
            style={[styles.pressable, { alignItems: align }]}
            onLayout={(event) => {
              height.value = event.nativeEvent.layout.height;
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
              <Animated.View style={[styles.content, contentStyle]}>{content}</Animated.View>
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

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
});