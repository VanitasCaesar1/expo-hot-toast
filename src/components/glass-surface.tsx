import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewProps, ViewStyle } from 'react-native';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import type { GlassStyle } from 'expo-glass-effect';
import type { GlassConfig } from '../core/types';
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

export type GlassSurfaceMode = 'glass' | 'opaque';

export interface GlassSurfaceProps extends ViewProps {
  theme: ToastTheme;
  /** `false` opts this toast out of glass entirely. */
  glass?: boolean | GlassConfig;
  /** True when the user has Reduce Transparency on. Forces opaque. */
  reduceTransparency?: boolean;
  /** Set while the toast is interactive (press-and-hold). */
  pressed?: boolean;
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
 * Two rungs, not one. `expo-glass-effect`'s own non-iOS implementation renders a
 * bare `<View>` with no effect at all, which means a silent no-op is the
 * library's default behaviour on Android and web. Shipping that as-is would
 * make Android look like a bug rather than a design, so the opaque rung is
 * always drawn with real colour, a real border and a real shadow.
 *
 * Opacity is never animated here or on any ancestor. UIKit skips installing the
 * glass effect when cumulative opacity is ~0 and does not retry, so fading a
 * glass toast in would leave it permanently blank. Motion lives on the content
 * and on transforms; the material itself only ever translates and scales.
 */
export const GlassSurface = React.memo(function GlassSurface({
  theme,
  glass,
  reduceTransparency = false,
  pressed = false,
  style,
  children,
  // Everything else (testID, accessibilityLabel, nativeID, pointerEvents, …) is
  // forwarded. Silently dropping it would make the surface untestable and
  // unreachable from native UI tests, accessibility tooling and E2E selectors.
  ...rest
}: GlassSurfaceProps) {
  const config = readGlassConfig(glass);
  const wantsGlass = glass !== false && config.style !== 'none';
  const mode: GlassSurfaceMode =
    wantsGlass && !reduceTransparency && GLASS_SUPPORTED ? 'glass' : 'opaque';

  if (mode === 'glass') {
    return (
      <GlassView
        {...rest}
        glassEffectStyle={resolveGlassStyle(config.style, pressed)}
        tintColor={config.tintColor}
        isInteractive={config.interactive ?? pressed}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View {...rest} style={[styles.opaque, opaqueStyle(theme), style]}>
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
): GlassStyleValue {
  const base: GlassStyle = style ?? 'regular';
  if (!pressed) return base;
  return { style: base, animate: true, animationDuration: 0.12 };
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

const styles = StyleSheet.create({
  opaque: {
    // overflow hidden so a real corner radius actually clips the content.
    // On the glass rung UIKit does this itself.
    overflow: 'hidden',
  },
});

export { NATIVE_GLASS };