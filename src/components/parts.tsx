import * as React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { isIndeterminate } from '../core/progress';
import type { ToastAvatar } from '../core/types';

/**
 * The parts a rich toast is built from. Everything that moves reads a shared
 * value on the UI thread, so progress and countdowns animate without React.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** Eases each progress write over a short interval, so steps read as motion. */
function useSmooth(progress: SharedValue<number>): SharedValue<number> {
  return useDerivedValue(() =>
    isIndeterminate(progress.value) ? progress.value : withTiming(progress.value, { duration: 220, easing: Easing.out(Easing.quad) }),
  );
}

/** A sliver that sweeps the track, for progress of unknown length. */
function useSweep(reduceMotion: boolean): SharedValue<number> {
  const sweep = useSharedValue(0);
  React.useEffect(() => {
    if (reduceMotion) return undefined;
    sweep.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(sweep);
  }, [reduceMotion, sweep]);
  return sweep;
}

export interface ProgressBarProps {
  progress: SharedValue<number>;
  color: string;
  trackColor: string;
  /** Divide the bar into this many steps. */
  segments?: number;
  reduceMotion: boolean;
  height?: number;
  /**
   * In the layout, under the text, as a rounded track (the default look),
   * rather than pinned along the toast's bottom edge. Steps become separate
   * pills that fill in turn.
   */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
  barStyle?: StyleProp<ViewStyle>;
}

/** One step of a segmented inline bar: full once passed, filling while current. */
function Segment({ index, count, progress, color, trackColor, height, barStyle }: {
  index: number;
  count: number;
  progress: SharedValue<number>;
  color: string;
  trackColor: string;
  height: number;
  barStyle?: StyleProp<ViewStyle>;
}) {
  const width = useSharedValue(0);
  const fill = useAnimatedStyle(() => {
    const p = isIndeterminate(progress.value) ? 0 : progress.value;
    const part = Math.min(Math.max(p * count - index, 0), 1);
    return { width: width.value * part };
  });
  return (
    <View
      style={[styles.segment, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fill, barStyle]} />
    </View>
  );
}

/** A progress bar: determinate, segmented, or sweeping; inline or along the bottom edge. */
export function ProgressBar({ progress, color, trackColor, segments, reduceMotion, inline = false, height = inline ? 4 : 3, style, barStyle }: ProgressBarProps) {
  const smooth = useSmooth(progress);
  const sweep = useSweep(reduceMotion);
  const width = useSharedValue(0);

  const fill = useAnimatedStyle(() => {
    if (isIndeterminate(smooth.value)) {
      // A third of the track, travelling from off one end to off the other.
      const span = width.value * 0.34;
      return { width: span, transform: [{ translateX: -span + (width.value + span) * sweep.value }] };
    }
    return { width: width.value * smooth.value, transform: [{ translateX: 0 }] };
  });

  if (inline && segments && segments > 1) {
    return (
      <View style={[styles.segments, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: segments }, (_, i) => (
          <Segment key={i} index={i} count={segments} progress={smooth} color={color} trackColor={trackColor} height={height} barStyle={barStyle} />
        ))}
      </View>
    );
  }

  return (
    <View
      style={[styles.track, inline && styles.trackInline, { height, backgroundColor: trackColor }, inline && { borderRadius: height / 2 }, style]}
      onLayout={(event) => {
        width.value = event.nativeEvent.layout.width;
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.fill, { backgroundColor: color }, inline && { borderRadius: height / 2 }, fill, barStyle]} />
      {!inline && segments && segments > 1
        ? Array.from({ length: segments - 1 }, (_, i) => (
            // Gaps between steps, cut through the track in the toast's own colour.
            <View key={i} style={[styles.gap, { left: `${((i + 1) / segments) * 100}%` }]} />
          ))
        : null}
    </View>
  );
}

export interface ProgressRingProps {
  progress: SharedValue<number>;
  size: number;
  color: string;
  trackColor: string;
  reduceMotion: boolean;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/** A ring that fills clockwise from the top, or spins an arc when indeterminate. */
export function ProgressRing({ progress, size, color, trackColor, reduceMotion, strokeWidth = 2.6, children }: ProgressRingProps) {
  const smooth = useSmooth(progress);
  const sweep = useSweep(reduceMotion);
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: isIndeterminate(smooth.value) ? circumference * 0.7 : circumference * (1 - smooth.value),
  }));
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: isIndeterminate(smooth.value) ? `${sweep.value * 360 - 90}deg` : '-90deg' }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[circumference, circumference]}
            animatedProps={arc}
          />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

/**
 * The percentage, written on the UI thread: a read-only TextInput whose text
 * is an animated prop, the usual way to show a changing number without React.
 */
export function ProgressPercent({ progress, style }: { progress: SharedValue<number>; style: StyleProp<TextStyle> }) {
  const props = useAnimatedProps(() => {
    const value = progress.value;
    const text = isIndeterminate(value) ? '' : `${Math.round(value * 100)}%`;
    return { text, defaultValue: text } as never;
  });
  return (
    <AnimatedTextInput
      editable={false}
      underlineColorAndroid="transparent"
      style={[styles.percent, style]}
      animatedProps={props}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

/** ×3: how many identical calls a deduplicated toast stands for. */
export function CountBadge({ count, color, background, style }: { count: number; color: string; background: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }, style]} accessibilityLabel={`${count} times`}>
      <Text style={[styles.badgeText, { color }]} maxFontSizeMultiplier={1.4}>
        ×{count}
      </Text>
    </View>
  );
}

/** A round avatar or thumbnail: an image source, or any element. */
export function Avatar({ avatar, size, style }: { avatar: ToastAvatar; size: number; style?: StyleProp<ViewStyle> }) {
  const source =
    typeof avatar === 'number' || (typeof avatar === 'object' && avatar !== null && 'uri' in (avatar as object))
      ? (avatar as { uri: string } | number)
      : undefined;
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {source !== undefined ? (
        <Image source={source} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      ) : (
        (avatar as React.ReactNode)
      )}
    </View>
  );
}

/** The expandable toast's toggle: a chevron that turns as the content opens. */
export function Chevron({ open, color, size = 16 }: { open: boolean; color: string; size?: number }) {
  const turn = useSharedValue(open ? 1 : 0);
  React.useEffect(() => {
    turn.value = withTiming(open ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

/**
 * A ring that drains around a button over the time the toast has left, as
 * Gmail's Undo does. It stops while the queue is paused and resumes after.
 */
export function CountdownRing({
  remaining,
  total,
  paused,
  size,
  color,
  children,
}: {
  remaining: number;
  total: number;
  paused: boolean;
  size: number;
  color: string;
  children?: React.ReactNode;
}) {
  const left = useSharedValue(total > 0 ? remaining / total : 0);
  React.useEffect(() => {
    if (!(total > 0) || !Number.isFinite(total)) return;
    if (paused) {
      cancelAnimation(left);
      return;
    }
    left.value = remaining / total;
    left.value = withTiming(0, { duration: Math.max(remaining, 0), easing: Easing.linear });
  }, [paused, remaining, total, left]);

  const r = (size - 2) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - left.value) }));
  return (
    <View style={[styles.countdown, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.countdownRing}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={2} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[circumference, circumference]}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  trackInline: {
    position: 'relative',
    left: undefined,
    right: undefined,
    bottom: undefined,
    alignSelf: 'stretch',
  },
  segments: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 4,
  },
  segment: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  gap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  percent: {
    padding: 0,
    margin: 0,
    minWidth: 38,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  badge: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  countdown: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownRing: {
    position: 'absolute',
  },
});
