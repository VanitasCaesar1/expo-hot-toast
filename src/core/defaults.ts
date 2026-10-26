import { PixelRatio } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type {
  DurationPreset,
  MotionConfig,
  ToastTheme,
  ToastThemeOverride,
  ToastType,
} from './types';

/**
 * rht's exact timing table. These are the numbers that make it feel like
 * react-hot-toast, so they are ported verbatim rather than tuned.
 */
/**
 * Symbolic durations.
 *
 * `react-native-snackbar` has exported LENGTH_SHORT / LENGTH_LONG /
 * LENGTH_INDEFINITE for a decade, and `@lucaleukert/expo-toast` independently
 * settled on the same three names. Matching the ecosystem beats inventing a
 * fourth vocabulary.
 */
export const durationPresets: Record<DurationPreset, number> = {
  short: 2000,
  long: 4500,
  infinite: Infinity,
};

export function resolveDuration(
  value: number | DurationPreset | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return value;
  return durationPresets[value];
}

export const defaultTimeouts: Record<ToastType, number> = {
  blank: 4000,
  error: 4000,
  success: 2000,
  loading: Infinity,
  info: 4000,
  warning: 4000,
  custom: 4000,
};

/**
 * rht's motion, translated from CSS curves into Reanimated easings.
 *
 * cubic-bezier(.21,1.02,.73,1) overshoots (y > 1) — it is a back/soft-out curve,
 * and it is the single biggest contributor to the "hot" feel. Exit uses a
 * *different* curve on purpose: cubic-bezier(.06,.71,.55,1) decelerates away
 * instead of bouncing back, because a dismissal that springs looks like a
 * rejection rather than a completion.
 */
export const defaultMotion: MotionConfig = {
  queueShift: 230,
  enter: 350,
  exit: 400,
  iconPop: 300,
  iconPopDelay: 120,
  stagger: 320,
  staggerMax: 900,
  enterEasing: Easing.bezier(0.21, 1.02, 0.73, 1),
  exitEasing: Easing.bezier(0.06, 0.71, 0.55, 1),
  iconEasing: Easing.bezier(0.175, 0.885, 0.32, 1.275),
  enterTranslate: 0.2,
  exitTranslate: 0.15,
  enterScale: 0.6,
  exitScale: 0.6,
};

export const defaultTheme: ToastTheme = {
  // Real glass ignores these on iOS 26+, but they define the fallback ladder
  // and the web/Android surface, so they have to be good on their own.
  background: 'rgba(255,255,255,0.72)',
  // Fully opaque. A translucent fill let text behind the toast ghost through
  // it on Android, and drew the elevation shadow through the surface.
  fallbackBackground: '#FFFFFF',
  border: 'rgba(255,255,255,0.6)',
  color: '#1c1c1e',
  radius: 22,
  paddingVertical: 14,
  paddingHorizontal: 18,
  maxWidth: 340,
  frostBlur: 18,
  frostSaturation: 180,
  frostHighlight: 'rgba(255,255,255,0.9)',
  shadowColor: '#000000',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffsetY: 6,
  elevation: 8,
  borderWidth: PixelRatio.get() >= 3 ? 0 : 1,
  fontSize: 15,
  lineHeight: 20,
  fontWeight: '500',
  maxLines: 3,
  descriptionMaxLines: 3,
  fill: false,
  descriptionColor: 'rgba(60,60,67,0.78)',
  descriptionFontSize: 13,
  descriptionLineHeight: 18,
  maxFontSizeMultiplier: 2,
  closeButtonBackground: 'rgba(0,0,0,0.07)',
  gap: 10,
  iconSize: 22,
  // iOS's systemBlue in light mode; #0A84FF is its dark-mode value, which
  // read at 3.65:1 on white.
  actionColor: '#007AFF',
  actionPaddingHorizontal: 12,
  rich: {
    success: { background: '#ECFDF3', border: '#BFF5D6', color: '#00702A', tint: 'rgba(52,199,89,0.22)' },
    error: { background: '#FFF0F0', border: '#FFD9DA', color: '#C8000F', tint: 'rgba(255,59,48,0.22)' },
    info: { background: '#EEF6FF', border: '#C9E2FF', color: '#0058C4', tint: 'rgba(10,132,255,0.2)' },
    warning: { background: '#FFF8EB', border: '#FFE2B0', color: '#9A5B00', tint: 'rgba(255,159,10,0.24)' },
  },
  motion: defaultMotion,
};

/**
 * Deep merge with motion special-cased. Shallow-spreading `motion` would let a
 * caller who overrides only `enter` silently reset every easing function back
 * to undefined, which crashes the animation rather than degrading.
 */
export function mergeTheme(
  base: ToastTheme,
  ...overrides: (ToastThemeOverride | undefined)[]
): ToastTheme {
  let result: ToastTheme = {
    ...base,
    motion: { ...base.motion },
    rich: copyRich(base.rich),
  };

  for (const override of overrides) {
    if (!override) continue;
    const { motion, rich, ...rest } = override;
    result = { ...result, ...rest } as ToastTheme;
    if (motion) result.motion = { ...result.motion, ...motion };
    // One level deeper for the same reason: overriding only the error tint must
    // not drop the success palette.
    if (rich) {
      result.rich = {
        success: { ...result.rich.success, ...rich.success },
        error: { ...result.rich.error, ...rich.error },
        info: { ...result.rich.info, ...rich.info },
        warning: { ...result.rich.warning, ...rich.warning },
      };
    }
  }

  return result;
}

function copyRich(rich: ToastTheme['rich']): ToastTheme['rich'] {
  return {
    success: { ...rich.success },
    error: { ...rich.error },
    info: { ...rich.info },
    warning: { ...rich.warning },
  };
}