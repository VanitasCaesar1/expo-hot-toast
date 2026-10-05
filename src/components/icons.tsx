import * as React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { ToastTheme } from '../core/types';

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
}

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

export function ToastIcon({ kind, size, theme }: ToastIconProps) {
  if (kind === 'blank') return null;

  if (kind === 'loading') {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={theme.color} />
      </View>
    );
  }

  const accent = ACCENTS[kind];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {kind === 'success' ? (
        <Path
          d="M20 6L9 17l-5-5"
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <Circle cx="12" cy="12" r="9.2" stroke={accent} strokeWidth={2.2} fill="none" />
          <Path
            d="M12 7.6v5.2M12 16.1h.01"
            stroke={accent}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

export { ACCENTS as TOAST_ICON_ACCENTS };

/**
 * Close glyph. Drawn rather than typed because a text "×" inherits font metrics
 * and lands inconsistently across type ramps; this is a fixed 24x24 box.
 */
export function CloseIcon({ size, color }: { size: number; color: string }) {
  if (!Svg || !Path) {
    return <Text style={{ fontSize: size, lineHeight: size, color }}>×</Text>;
  }

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