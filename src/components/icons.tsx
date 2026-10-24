import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { IconTheme, ToastTheme } from '../core/types';

/**
 * react-native-svg ships in every Expo template and is a required peer, same as
 * Reanimated and Gesture Handler.
 *
 * It was previously an optional peer loaded through a try/catch `require`, so
 * the package would render colour dots instead of glyphs when it was absent.
 * That fallback was never worth the cost: a `require()` inside a module also
 * makes bundlers treat it as CommonJS and emit broken ESM interop, which is a
 * far worse failure than a missing dependency is.
 */

export type ToastIconKind = 'success' | 'error' | 'loading' | 'blank';

export interface ToastIconProps {
  kind: ToastIconKind;
  size: number;
  theme: ToastTheme;
  /** Overrides the glyph's stroke (and the spinner's colour) with `primary`. */
  iconTheme?: IconTheme;
  /**
   * Draw the finished glyph with no draw-in. The wrapper's pop lives in the bar;
   * this covers the strokes themselves.
   */
  reduceMotion?: boolean;
}

const CHECK_PATH = 'M20 6L9 17l-5-5';
/**
 * Length of CHECK_PATH, from its two segments: (20,6) to (9,17), then (9,17) to
 * (4,12). Needed because the draw-in is a dash offset, which has to start at
 * exactly the path length: shorter shows a stub, longer delays the first pixel.
 */
export const CHECK_PATH_LENGTH = Math.hypot(11, 11) + Math.hypot(5, 5);

/**
 * react-hot-toast's checkmark timing: 200ms ease-out, starting 200ms after the
 * icon mounts. The delay is absolute, so it overlaps the end of the wrapper's
 * pop rather than waiting for it.
 */
const CHECK_DRAW_DELAY = 200;
const CHECK_DRAW_DURATION = 200;
/** The error mark lands this long after the circle starts its pop. */
const ERROR_MARK_LAG = 150;
const ERROR_MARK_DURATION = 200;
// CSS `ease-out`, which Reanimated's Easing has no named export for.
const DRAW_EASING = Easing.bezier(0, 0, 0.58, 1);

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Per-type accent colours. These are deliberately not part of the token
 * interface: they describe type semantics (this is a failure), not the
 * material. Overridable via `theme` if a product needs its own palette, but
 * the defaults should read as correct without configuration.
 */
const ACCENTS: Record<ToastIconKind, string> = {
  success: '#34C759',
  error: '#FF3B30',
  loading: '#8E8E93',
  blank: '#8E8E93',
};

export function ToastIcon({
  kind,
  size,
  theme,
  iconTheme,
  reduceMotion = false,
}: ToastIconProps) {
  // Anything without a glyph of its own draws nothing. The bar casts
  // `toast.type` straight to this union, so a `custom` toast routed through a
  // bar previously fell through to the error branch and drew a red-less error
  // circle with an undefined stroke.
  if (kind !== 'success' && kind !== 'error' && kind !== 'loading') return null;

  if (kind === 'loading') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={iconTheme?.primary ?? theme.color} />
      </View>
    );
  }

  const accent = iconTheme?.primary ?? ACCENTS[kind];

  // Separate components so each owns its own shared value: the hooks cannot sit
  // in `ToastIcon` itself, which returns early above, and a type change in place
  // (loading -> success) must mount a fresh glyph so its draw-in replays.
  return kind === 'success' ? (
    <SuccessGlyph size={size} color={accent} reduceMotion={reduceMotion} />
  ) : (
    <ErrorGlyph
      size={size}
      color={accent}
      reduceMotion={reduceMotion}
      markDelay={theme.motion.iconPopDelay + ERROR_MARK_LAG}
    />
  );
}

interface GlyphProps {
  size: number;
  color: string;
  reduceMotion: boolean;
}

function SuccessGlyph({ size, color, reduceMotion }: GlyphProps) {
  // 0 = undrawn, 1 = drawn. Starts drawn under Reduce Motion so the first frame
  // is already final.
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    draw.value = withDelay(
      CHECK_DRAW_DELAY,
      withTiming(1, { duration: CHECK_DRAW_DURATION, easing: DRAW_EASING }),
    );
  }, [reduceMotion, draw]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_PATH_LENGTH * (1 - draw.value),
  }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d={CHECK_PATH}
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        // The gap is wider than the path so the dash pattern cannot repeat inside
        // it: with a round cap, a second dash starting at the end of the path
        // would paint a dot there while the check is still undrawn.
        strokeDasharray={[CHECK_PATH_LENGTH, CHECK_PATH_LENGTH * 2]}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

function ErrorGlyph({ size, color, reduceMotion, markDelay }: GlyphProps & { markDelay: number }) {
  const mark = useSharedValue(reduceMotion ? 1 : 0);

  React.useEffect(() => {
    if (reduceMotion) {
      mark.value = 1;
      return;
    }
    mark.value = 0;
    mark.value = withDelay(
      markDelay,
      withTiming(1, { duration: ERROR_MARK_DURATION, easing: DRAW_EASING }),
    );
  }, [reduceMotion, markDelay, mark]);

  // The mark fades in rather than drawing: it is a stem plus a dot, and a dash
  // offset restarts per subpath, so it would not reveal in one pass.
  const animatedProps = useAnimatedProps(() => ({ opacity: mark.value }));

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9.2" stroke={color} strokeWidth={2.2} fill="none" />
      <AnimatedPath
        d="M12 7.6v5.2M12 16.1h.01"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

export { ACCENTS as TOAST_ICON_ACCENTS };

/**
 * Close glyph. Drawn rather than typed because a text "×" inherits font metrics
 * and lands inconsistently across type ramps; this is a fixed 24x24 box.
 */
export function CloseIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6L18 18M18 6L6 18"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}