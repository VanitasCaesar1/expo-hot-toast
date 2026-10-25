import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';
import type { MotionConfig, ToastThemeOverride, ToastVariant } from './types';

/**
 * A Toaster's preset: the look it starts from before any `theme` override.
 *
 * - `glass`: the pill, in Liquid Glass on iOS 26 and frosted glass on the web.
 * - `material`: a Material 3 snackbar: full width less a margin, near-square
 *   corners, on the inverse surface, rising from the bottom.
 * - `auto`: `material` on Android, `glass` everywhere else.
 */
export type ToasterPreset = 'auto' | 'glass' | 'material';

export function resolvePreset(preset: ToasterPreset = 'auto'): Exclude<ToasterPreset, 'auto'> {
  if (preset !== 'auto') return preset;
  return Platform.OS === 'android' ? 'material' : 'glass';
}

/**
 * Material 3's snackbar, from the current baseline tokens: the inverse surface
 * and its text, the inverse primary for the action, 14sp body text. Two
 * deliberate departures, for a less stock look: 12dp corners (the spec's 4dp
 * reads as dated next to Android 16's rounder shapes) and a softer, wider
 * shadow. Pass `theme` to bring in your own colours, or `radius: 4` for the
 * spec's corners.
 */
export function materialTheme(scheme: 'light' | 'dark'): ToastThemeOverride {
  const light = scheme === 'light';
  return {
    fallbackBackground: light ? '#322F35' : '#E6E0E9',
    background: light ? 'rgba(50,47,53,0.96)' : 'rgba(230,224,233,0.96)',
    border: 'transparent',
    borderWidth: 0,
    color: light ? '#F5EFF7' : '#322F35',
    descriptionColor: light ? 'rgba(245,239,247,0.72)' : 'rgba(50,47,53,0.72)',
    actionColor: light ? '#D0BCFF' : '#6750A4',
    closeButtonBackground: 'transparent',
    radius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    maxWidth: 600,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    descriptionFontSize: 13,
    descriptionLineHeight: 18,
    elevation: 4,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffsetY: 4,
    fill: true,
  };
}

/**
 * How toasts come and go.
 *
 * - `hot`: react-hot-toast's overshooting pop, the default.
 * - `slide`: in from the edge by its full height, no scale.
 * - `fade`: in place, opacity only.
 * - `pop`: from small to full size, in place.
 * - `none`: no motion; toasts appear and leave at once.
 */
export type ToastAnimation = 'hot' | 'slide' | 'fade' | 'pop' | 'none';

export function animationMotion(animation: ToastAnimation | undefined): Partial<MotionConfig> | undefined {
  switch (animation) {
    case 'slide':
      return {
        enterTranslate: 1.3,
        exitTranslate: 1.3,
        enterScale: 1,
        exitScale: 1,
        enter: 380,
        exit: 300,
        enterEasing: Easing.bezier(0.16, 1, 0.3, 1),
        exitEasing: Easing.bezier(0.7, 0, 0.84, 0),
      };
    case 'fade':
      return { enterTranslate: 0, exitTranslate: 0, enterScale: 0.98, exitScale: 0.98, enter: 220, exit: 200, enterEasing: Easing.out(Easing.quad) };
    case 'pop':
      return { enterTranslate: 0, exitTranslate: 0, enterScale: 0.7, exitScale: 0.85, enter: 320, exit: 220 };
    case 'none':
      return { enter: 0, exit: 0, queueShift: 0, iconPop: 0, iconPopDelay: 0, enterTranslate: 0, exitTranslate: 0, enterScale: 1, exitScale: 1 };
    default:
      return undefined;
  }
}

/** The shape a toast takes when it asks for `'auto'`. */
export function resolveVariant(variant: ToastVariant | undefined, preset: Exclude<ToasterPreset, 'auto'>): Exclude<ToastVariant, 'auto'> {
  if (variant && variant !== 'auto') return variant;
  return preset === 'material' ? 'snackbar' : 'pill';
}

/** Each shape's own tokens, laid over the Toaster's theme. */
export function variantTheme(variant: Exclude<ToastVariant, 'auto'>): ToastThemeOverride | undefined {
  switch (variant) {
    case 'card':
      return { radius: 20, paddingVertical: 12, paddingHorizontal: 14, maxWidth: 420, fill: true, gap: 12 };
    case 'banner':
      return { radius: 0, paddingVertical: 12, paddingHorizontal: 18, maxWidth: 10000, fill: true, shadowOpacity: 0.08 };
    case 'hud':
      // A HUD hugs its content, even under a preset that fills (Material).
      return { radius: 28, paddingVertical: 22, paddingHorizontal: 26, maxWidth: 240, iconSize: 44, fontSize: 16, lineHeight: 21, fill: false };
    case 'island':
      // The Dynamic Island is black in either appearance, so the capsule is too.
      return {
        radius: 999,
        fill: false,
        paddingVertical: 10,
        paddingHorizontal: 16,
        maxWidth: 360,
        fallbackBackground: '#000000',
        background: '#000000',
        color: '#FFFFFF',
        descriptionColor: 'rgba(255,255,255,0.68)',
        border: 'transparent',
        borderWidth: 0,
        closeButtonBackground: 'rgba(255,255,255,0.16)',
        actionColor: '#FFD60A',
        shadowOpacity: 0.3,
        iconSize: 20,
        fontSize: 15,
      };
    default:
      return undefined;
  }
}

/** Each shape's own motion: a HUD scales in place, an island grows out of the notch. */
export function variantMotion(variant: Exclude<ToastVariant, 'auto'>): Partial<MotionConfig> | undefined {
  switch (variant) {
    case 'hud':
      return { enterTranslate: 0, exitTranslate: 0, enterScale: 0.8, exitScale: 0.9 };
    case 'island':
      return { enterTranslate: 0.15, exitTranslate: 0.1, enterScale: 0.35, exitScale: 0.5, enter: 480, enterEasing: Easing.bezier(0.2, 1.25, 0.4, 1) };
    case 'banner':
      return { enterTranslate: 1, exitTranslate: 1, enterScale: 1, exitScale: 1 };
    default:
      return undefined;
  }
}
