import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import type { GlassStyle } from 'expo-glass-effect';
import type { GlassConfig, ToastBlur } from '../core/types';
import type { ToastTheme } from '../core/types';

/**
 * Availability is read once at module scope, not per render.
 *
 * Both predicates are themselves memoized and `isLiquidGlassAvailable` reads a
 * compile-time constant, so there is nothing to gain from calling per render and
 * a branch to keep in sync. Evaluating at import also means the answer is stable
 * for the lifetime of the bundle, which is what we want: a toast that appears
 * as glass and then flips to opaque when the queue reflows would be a visible
 * artifact.
 */
const NATIVE_GLASS =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * Why this second guard exists: early iOS 26 betas threw inside the
 * `UIGlassEffect` initializer (expo/expo#40911). `isGlassEffectAPIAvailable`
 * was added to give apps an escape hatch for those builds. On iOS 26 with a
 * beta that predates the fix, mounting a GlassView crashes the app rather than
 * degrading, so we treat "API not available" as "no glass".
 */
export const GLASS_SUPPORTED = NATIVE_GLASS;

/**
 * Browsers that can blur what is behind an element. Liquid Glass is UIKit's and
 * has no web counterpart, so on the web the glass setting draws frosted glass
 * instead: a CSS backdrop blur under a translucent fill, with a lit rim. The
 * recipe follows Glassy UI's frost (glassyui.com, MIT).
 */
const WEB_FROST =
  Platform.OS === 'web' &&
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  (CSS.supports('backdrop-filter', 'blur(1px)') ||
    CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));

export const FROST_SUPPORTED = WEB_FROST;

export type GlassSurfaceMode = 'glass' | 'frost' | 'blur' | 'opaque';

export interface GlassSurfaceProps extends ViewProps {
  theme: ToastTheme;
  /** `false` opts this toast out of glass entirely. */
  glass?: boolean | GlassConfig;
  /**
   * A blur view for platforms with neither Liquid Glass nor frost (Android,
   * iOS before 26). Without it they get the opaque surface.
   */
  blur?: ToastBlur;
  /** True when the user has Reduce Transparency on. Forces opaque. */
  reduceTransparency?: boolean;
  /** Set while the toast is interactive (press-and-hold). */
  pressed?: boolean;
  /**
   * Whether the material should be on screen. Default true.
   *
   * The glass materializes after mount and dematerializes when this turns
   * false, both through UIKit's own effect animation — the supported way to
   * bring glass in and out, since opacity cannot be used on it. Ignored on the
   * opaque rung, which the caller fades with the rest of the toast.
   */
  visible?: boolean;
  /**
   * Forces the material's appearance. Glass otherwise follows the system, so a
   * Toaster that forces dark tokens on a light-mode device drew light text on
   * light glass.
   */
  colorScheme?: 'light' | 'dark';
  /** Materialize duration in ms. Default 350. */
  enterDuration?: number;
  /** Dematerialize duration in ms. Default 400. */
  exitDuration?: number;
  /**
   * Corner radius of the material. Defaults to `theme.radius`. Applied to the
   * surface itself on both rungs, so nothing above it has to clip.
   */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

function readGlassConfig(
  glass: GlassSurfaceProps['glass'],
): GlassConfig {
  if (typeof glass === 'object' && glass !== null) return glass;
  return {};
}

/**
 * The material behind a toast.
 *
 * Three rungs: Liquid Glass on iOS 26, frosted glass in browsers that can blur
 * a backdrop, and an opaque surface everywhere else. `expo-glass-effect`'s own
 * non-iOS implementation renders a bare `<View>` with no effect at all, which
 * means a silent no-op is the library's default behaviour on Android and web.
 * Shipping that as-is would make Android look like a bug rather than a design,
 * so the opaque rung is always drawn with real colour, a real border and a
 * real shadow.
 *
 * Opacity is never animated here or on any ancestor. UIKit skips installing the
 * glass effect when cumulative opacity is ~0 and does not retry, so fading a
 * glass toast in would leave it permanently blank. Motion lives on the content
 * and on transforms; the material itself only ever translates and scales.
 */
export const GlassSurface = React.memo(function GlassSurface({
  theme,
  glass,
  blur,
  reduceTransparency = false,
  pressed = false,
  visible = true,
  colorScheme,
  enterDuration = 350,
  exitDuration = 400,
  radius,
  style,
  children,
  // Everything else (testID, accessibilityLabel, nativeID, pointerEvents, …) is
  // forwarded. Silently dropping it would make the surface untestable and
  // unreachable from native UI tests, accessibility tooling and E2E selectors.
  ...rest
}: GlassSurfaceProps) {
  const config = readGlassConfig(glass);
  const wantsGlass = glass !== false && config.style !== 'none';
  const translucent = wantsGlass && !reduceTransparency;
  const mode: GlassSurfaceMode = !translucent
    ? 'opaque'
    : GLASS_SUPPORTED
      ? 'glass'
      : FROST_SUPPORTED
        ? 'frost'
        : blur
          ? 'blur'
          : 'opaque';
  const shape: ViewStyle = {
    borderRadius: radius ?? theme.radius,
    borderCurve: 'continuous',
  };

  // False for the first frame, so the effect is first installed as 'none' and
  // then animated in. Assigning the effect inside an animation is what makes
  // UIKit materialize it rather than snapping it on.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    if (mode !== 'glass') return undefined;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  if (mode === 'glass') {
    const present = visible && mounted;
    return (
      <GlassView
        {...rest}
        glassEffectStyle={
          present
            ? resolveGlassStyle(config.style, pressed, enterDuration)
            : {
                style: 'none',
                // Only the exit animates. The pre-mount 'none' must apply
                // immediately, or the first frame would show the glass.
                animate: !visible,
                animationDuration: exitDuration / 1000,
              }
        }
        tintColor={config.tintColor}
        {...(colorScheme ? { colorScheme } : null)}
        isInteractive={config.interactive ?? pressed}
        style={[shape, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (mode === 'frost') {
    return (
      <View {...rest} style={[shape, frostStyle(theme, config.tintColor), style]}>
        {children}
      </View>
    );
  }

  if (mode === 'blur') {
    const Blur = blur!.component;
    return (
      <View {...rest} style={[styles.blur, shape, { borderColor: theme.border, borderWidth: theme.borderWidth }, style]}>
        <Blur
          tint={colorScheme ?? 'default'}
          {...blur!.props}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
        />
        {config.tintColor ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: config.tintColor }]} />
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <View {...rest} style={[styles.opaque, shape, opaqueStyle(theme), style]}>
      {children}
    </View>
  );
});

/**
 * `animate` is how you change a glass effect without touching opacity, so the
 * press feedback moves the effect's own opacity — a supported path — rather than
 * animating the view.
 *
 * animationDuration is in SECONDS here, unlike every other duration in this
 * library. Getting that wrong yields a 4000x-too-long press transition.
 */
type GlassStyleValue = GlassStyle | { style: GlassStyle; animate: boolean; animationDuration: number };

function resolveGlassStyle(
  style: GlassStyle | undefined,
  pressed: boolean,
  enterDuration: number,
): GlassStyleValue {
  const base: GlassStyle = style ?? 'regular';
  // Always the config form, with `animate` on. expo-glass-effect only reads
  // the flag when the style itself changes, so this animates the 'none' ->
  // material transition on mount and nothing else.
  return {
    style: base,
    animate: true,
    animationDuration: pressed ? 0.12 : enterDuration / 1000,
  };
}

function opaqueStyle(theme: ToastTheme): ViewStyle {
  return {
    backgroundColor: theme.fallbackBackground,
    borderColor: theme.border,
    borderWidth: theme.borderWidth,
    shadowColor: theme.shadowColor,
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: theme.shadowRadius,
    shadowOffset: { width: 0, height: theme.shadowOffsetY },
    elevation: theme.elevation,
  };
}

/** `color` at `percent` strength, for colours given in any CSS form. */
function fade(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(percent)}%, transparent)`;
}

/**
 * The web rung. The fill is `theme.background`, the translucent token, with any
 * glass tint laid over it, and the backdrop is blurred and saturated behind.
 * The edge is an inset shadow stack lit from the top left: a bright bevel, a
 * softer counter-bevel, an inner glow and a faint chromatic fringe, ringed by
 * the border colour and lifted by the theme's own shadow.
 *
 * React Native's types have no backdrop filter, so the style is cast; React
 * Native Web passes it through to the DOM, prefixing it for Safari.
 */
function frostStyle(theme: ToastTheme, tintColor: string | undefined): ViewStyle {
  const filter = `blur(${theme.frostBlur}px) saturate(${theme.frostSaturation}%)`;
  const light = theme.frostHighlight;
  const shadow = [
    `inset 0 0 0 1px ${theme.border}`,
    `inset 0 0 12px -4px ${fade(light, 60)}`,
    `inset 1.5px 2.5px 1px -2px ${fade(light, 70)}`,
    `inset -1.5px -2px 1px -2px ${fade(light, 50)}`,
    'inset 2px 0 3px -1px rgb(80 160 255 / 0.06)',
    'inset -2px 0 3px -1px rgb(255 90 150 / 0.06)',
    `0 ${theme.shadowOffsetY}px ${theme.shadowRadius * 2}px ${fade(theme.shadowColor, theme.shadowOpacity * 100)}`,
  ].join(', ');
  return {
    backgroundColor: theme.background,
    ...(tintColor ? { backgroundImage: `linear-gradient(${tintColor}, ${tintColor})` } : null),
    backdropFilter: filter,
    boxShadow: shadow,
  } as ViewStyle;
}

const styles = StyleSheet.create({
  // A blur view does not follow its parent's corner radius by itself, so this
  // rung clips. It has no shadow to lose: a shadow under a translucent surface
  // would show through it.
  blur: {
    overflow: 'hidden',
  },
  opaque: {
    // Deliberately not `overflow: hidden`. The background already follows the
    // corner radius, and on iOS clipping also clips the layer's own shadow — so
    // the shadow tokens, the fallback's whole depth cue, never rendered.
  },
});

export { NATIVE_GLASS, WEB_FROST };