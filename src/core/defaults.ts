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
  fallbackBackground: 'rgba(255,255,255,0.92)',
  border: 'rgba(255,255,255,0.6)',
  color: '#1c1c1e',
  radius: 22,
  paddingVertical: 14,
  paddingHorizontal: 18,
  maxWidth: 340,
  shadowColor: '#000000',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffsetY: 6,
  elevation: 8,
  borderWidth: PixelRatio.get() >= 3 ? 0 : 1,
  fontSize: 15,
  lineHeight: 20,
  fontWeight: '500',
  closeButtonBackground: 'rgba(0,0,0,0.07)',
  gap: 10,
  iconSize: 22,
  actionColor: '#0A84FF',
  actionPaddingHorizontal: 12,
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
  let result: ToastTheme = { ...base, motion: { ...base.motion } };

  for (const override of overrides) {
    if (!override) continue;
    const { motion, ...rest } = override;
    result = { ...result, ...rest } as ToastTheme;
    if (motion) result.motion = { ...result.motion, ...motion };
  }

  return result;
}