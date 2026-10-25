/**
 * The few React Native APIs the shared core touches, for the DOM build. The
 * web bundle aliases `react-native` to this file, so the core (store, toast
 * API, queue, themes) runs in a plain React app with no React Native at all.
 */
import { useSyncExternalStore } from 'react';

const hasWindow = typeof window !== 'undefined';

export const Platform = {
  OS: 'web' as 'ios' | 'android' | 'web' | 'windows' | 'macos',
  select<T>(options: { web?: T; default?: T }): T | undefined {
    return 'web' in options ? options.web : options.default;
  },
};

export const PixelRatio = {
  get: (): number => (hasWindow ? window.devicePixelRatio || 1 : 1),
};

export const I18nManager = {
  get isRTL(): boolean {
    return typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  },
};

export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/** A hidden tab counts as backgrounded, as an app sent to the background does. */
export const AppState = {
  get currentState(): AppStateStatus {
    return typeof document === 'undefined' || document.visibilityState === 'visible' ? 'active' : 'background';
  },
  addEventListener(_type: 'change', listener: (state: AppStateStatus) => void): { remove: () => void } {
    if (typeof document === 'undefined') return { remove: () => {} };
    const onChange = () => listener(AppState.currentState);
    document.addEventListener('visibilitychange', onChange);
    return { remove: () => document.removeEventListener('visibilitychange', onChange) };
  },
};

export type ColorSchemeName = 'light' | 'dark' | null | undefined;

const darkQuery = (): MediaQueryList | null =>
  hasWindow && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function subscribeScheme(callback: () => void): () => void {
  const query = darkQuery();
  if (!query) return () => {};
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/** The system appearance, following changes. Light during server rendering. */
export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    subscribeScheme,
    () => (darkQuery()?.matches ? 'dark' : 'light'),
    () => 'light',
  );
}

// Style types, for the shared type declarations. On the web a style is CSS.
type CSS = import('react').CSSProperties;
export type ViewStyle = CSS;
export type TextStyle = CSS;
export type ImageStyle = CSS;
// As in React Native, a style may be an array of styles; the DOM build flattens it.
export type StyleProp<T> = T | ReadonlyArray<StyleProp<T>> | undefined | null | false;
export type ImageSourcePropType = { uri: string } | string;
