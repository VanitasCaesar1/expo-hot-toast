import { withAlpha } from '../utils/color';
import type { ToastThemeOverride } from '../core/types';

/**
 * Bring an app's own look to its toasts.
 *
 * `themeFromColors` takes the handful of semantic colours every design system
 * has (Unistyles, Tamagui, a plain constants file) and derives the rest;
 * `fromNavigationTheme` does the same from a React Navigation theme, so toasts
 * match the screens they appear over without a second palette to keep in step.
 */

export interface ColorTokens {
  /** The surface: a card or sheet colour. */
  background: string;
  /** Text on that surface. */
  text: string;
  /** Text for secondary lines. Default: `text` at 70%. */
  mutedText?: string;
  /** The brand colour, for the action button. Default: `text`. */
  accent?: string;
  /** Hairline round the surface. Default: `text` at 12%. */
  border?: string;
  radius?: number;
  fontFamily?: string;
}

export function themeFromColors(tokens: ColorTokens): ToastThemeOverride {
  return {
    fallbackBackground: tokens.background,
    // The translucent fill frosted glass draws on the web.
    background: withAlpha(tokens.background, 0.78),
    color: tokens.text,
    descriptionColor: tokens.mutedText ?? withAlpha(tokens.text, 0.7),
    border: tokens.border ?? withAlpha(tokens.text, 0.12),
    actionColor: tokens.accent ?? tokens.text,
    closeButtonBackground: withAlpha(tokens.text, 0.08),
    ...(tokens.radius === undefined ? null : { radius: tokens.radius }),
    ...(tokens.fontFamily === undefined ? null : { fontFamily: tokens.fontFamily }),
  };
}

/** The parts of a React Navigation theme this reads. */
export interface NavigationThemeLike {
  dark: boolean;
  colors: { card: string; text: string; border: string; primary: string };
  fonts?: { regular?: { fontFamily?: string }; medium?: { fontFamily?: string } };
}

/**
 * Toaster props from a React Navigation theme:
 * `<Toaster {...fromNavigationTheme(useTheme())} />`.
 */
export function fromNavigationTheme(theme: NavigationThemeLike): { colorScheme: 'light' | 'dark'; theme: ToastThemeOverride } {
  const fontFamily = theme.fonts?.medium?.fontFamily ?? theme.fonts?.regular?.fontFamily;
  return {
    colorScheme: theme.dark ? 'dark' : 'light',
    theme: {
      ...themeFromColors({
        background: theme.colors.card,
        text: theme.colors.text,
        border: theme.colors.border,
        accent: theme.colors.primary,
        fontFamily,
      }),
      ...(theme.fonts?.regular?.fontFamily ? { descriptionFontFamily: theme.fonts.regular.fontFamily } : null),
    },
  };
}
