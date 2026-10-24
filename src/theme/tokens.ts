import { useColorScheme } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import { defaultTheme, mergeTheme } from '../core/defaults';
import type { ToastTheme, ToastThemeOverride } from '../core/types';

export {
  defaultTheme,
  defaultMotion,
  defaultTimeouts,
  mergeTheme,
} from '../core/defaults';

/**
 * Dark variant. iOS 26 real glass adapts itself to the appearance, so these
 * values only ever surface on the fallback path — but that path has to look
 * deliberate rather than like an oversight.
 */
export const darkTheme: ToastTheme = {
  ...defaultTheme,
  background: 'rgba(28,28,30,0.72)',
  // Opaque, and one step lighter than a black page (iOS's elevated grouped
  // background), so the toast separates from it without relying on the border.
  fallbackBackground: '#2C2C2E',
  border: 'rgba(255,255,255,0.14)',
  color: '#f2f2f7',
  closeButtonBackground: 'rgba(255,255,255,0.18)',
  shadowOpacity: 0.3,
  descriptionColor: 'rgba(235,235,245,0.68)',
  rich: {
    success: { background: '#032313', border: '#0B4425', color: '#5FE39A', tint: 'rgba(48,209,88,0.26)' },
    error: { background: '#2E0809', border: '#561317', color: '#FF8F92', tint: 'rgba(255,69,58,0.26)' },
  },
};

export interface ResolveThemeOptions {
  theme?: ToastThemeOverride;
  colorScheme?: ColorSchemeName;
}

/**
 * Pure. Deliberately does not call `useColorScheme` — it is exported for use
 * outside a React component (in a config file, a StyleSheet factory, a test),
 * and a hook call here would throw there and lint as a violation everywhere.
 * Pass `colorScheme` explicitly if you want auto-switching outside the
 * `useToastTheme` hook.
 */
export function resolveTheme({
  theme,
  colorScheme,
}: ResolveThemeOptions = {}): ToastTheme {
  const base = colorScheme === 'dark' ? darkTheme : defaultTheme;
  return mergeTheme(base, theme);
}

/**
 * The hook form, for components that want auto light/dark switching.
 *
 * `colorScheme` overrides the system setting. This exists because the system
 * preference is not always the right answer: an app that forces a dark UI while
 * the OS is in light mode would otherwise get light-theme tokens — dark text on
 * a dark surface, which is close to invisible. Glass adapts to the app's
 * appearance, so the token that decides text contrast has to follow the app, not
 * the OS.
 */
export function useToastTheme(
  theme?: ToastThemeOverride,
  colorScheme?: ColorSchemeName,
): ToastTheme {
  const system = useColorScheme();
  const scheme = colorScheme ?? system;
  return mergeTheme(scheme === 'dark' ? darkTheme : defaultTheme, theme);
}