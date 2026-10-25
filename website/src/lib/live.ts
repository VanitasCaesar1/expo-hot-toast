/**
 * The real library, running on this page.
 *
 * expo-hot-toast/web, the library's DOM build, mounts as a page-level Toaster
 * (lib/live-root.tsx) and exposes the real `toast` on `window.expoHotToast`.
 * Every button on the site goes through here, so the toasts you see over the
 * page are expo-hot-toast itself, drawn in its frosted web glass.
 *
 * The Toaster's props live in one store, shared by every control on the page,
 * so the position picker and the customiser edit the same Toaster.
 */

type Options = Record<string, unknown>;
type Show = (message: string, options?: Options) => string;

interface Progress {
  id: string;
  set: (progress: number | 'indeterminate') => void;
  success: (message: string, options?: Options) => void;
  error: (message: string, options?: Options) => void;
  dismiss: () => void;
}

/** The parts of expo-hot-toast's `toast` the site calls. */
interface Toast extends Show {
  success: Show;
  error: Show;
  info: Show;
  warning: Show;
  loading: Show;
  hud: Show;
  banner: Show;
  island: Show;
  update: (id: string, changes: Options) => void;
  progress: (message: string, options?: Options) => Progress;
  steps: (labels: string[], options?: Options) => Omit<Progress, 'set'> & { next: () => void };
  promise: <T>(promise: Promise<T>, messages: { loading: string; success: string; error: string }, options?: Options) => Promise<T>;
  dismiss: (id?: string) => void;
}

export interface LiveConfig {
  offset?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  reverseOrder?: boolean;
  stacked?: boolean;
  colorScheme?: 'light' | 'dark';
  glass?: boolean | { tintColor?: string };
  theme?: Record<string, unknown>;
  toastOptions?: Record<string, unknown>;
  preset?: 'auto' | 'glass' | 'material';
  animation?: 'hot' | 'slide' | 'fade' | 'pop' | 'none';
  icons?: Record<string, unknown>;
}

interface LiveApi {
  toast: Toast;
  configure: (config: LiveConfig) => void;
  examples: Record<string, (options?: Options) => void>;
  /** Props for the hero's stage Toaster (toasterId "stage"). */
  configureStage: (
    config: LiveConfig & { offset?: number; gap?: number; visibleToasts?: number; preset?: 'auto' | 'glass' | 'material'; animation?: string },
    id?: string,
  ) => void;
}

declare global {
  interface Window {
    __EHT_EMBED__?: boolean | { config?: LiveConfig };
    expoHotToast?: LiveApi;
  }
}

import { getScheme, onScheme } from './theme';

let config: LiveConfig = { position: 'top-center' };
let followingTheme = false;

/** The page's toasts take the site's theme, and keep following it. */
function followTheme(): void {
  if (followingTheme) return;
  followingTheme = true;
  config = { ...config, colorScheme: getScheme() };
  onScheme((scheme) => configure({ colorScheme: scheme }));
}
const listeners = new Set<() => void>();
let loading: Promise<LiveApi> | undefined;

export function getConfig(): LiveConfig {
  if (typeof window !== 'undefined') followTheme();
  return config;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function configure(next: LiveConfig): void {
  config = { ...config, ...next };
  window.expoHotToast?.configure(next);
  listeners.forEach((listener) => listener());
}

/** Loads the library once; resolves when its Toaster is mounted. */
export function live(): Promise<LiveApi> {
  if (window.expoHotToast) return Promise.resolve(window.expoHotToast);
  followTheme();
  loading ??= new Promise<LiveApi>((resolve, reject) => {
    window.addEventListener('expo-hot-toast:ready', () => resolve(window.expoHotToast!), { once: true });
    import('./live-root').then(
      ({ mount }) => {
        let root = document.getElementById('root');
        if (!root) {
          root = document.createElement('div');
          root.id = 'root';
          root.className = 'live-root';
          document.body.append(root);
        }
        mount(root, config as never);
      },
      (error: unknown) => reject(error),
    );
  });
  return loading;
}

/** Runs `fire` with the library's `toast`, loading it first if needed. */
export function withToast(fire: (toast: Toast, api: LiveApi) => void): void {
  live().then(
    (api) => fire(api.toast, api),
    (error: unknown) => console.warn(error),
  );
}
