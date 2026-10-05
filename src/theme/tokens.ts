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
  fallbackBackground: 'rgba(28,28,30,0.94)',
  border: 'rgba(255,255,255,0.14)',
  color: '#f2f2f7',
  closeButtonBackground: 'rgba(255,255,255,0.18)',
  shadowOpacity: 0.3,
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