/**
 * The real library, running on this page.
 *
 * The example app's web build (exported by CI into /playground) can mount as a
 * page-level Toaster instead of the app: set `window.__EHT_EMBED__`, load its
 * script, and it exposes the real `toast` on `window.expoHotToast`. Every
 * button on the site goes through here, so the toasts you see over the page are
 * expo-hot-toast itself, on React Native Web, drawn in its frosted web glass.
 *
 * The Toaster's props live in one store, shared by every control on the page,
 * so the position picker and the customiser edit the same Toaster.
 */

type Options = Record<string, unknown>;
type Show = (message: string, options?: Options) => string;

/** The parts of expo-hot-toast's `toast` the site calls. */
interface Toast extends Show {
  success: Show;
  error: Show;
  loading: Show;
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
}

interface LiveApi {
  toast: Toast;
  configure: (config: LiveConfig) => void;
  examples: Record<string, () => void>;
  /** Props for the hero's stage Toaster (toasterId "stage"). */
  configureStage: (config: LiveConfig & { offset?: number; gap?: number }) => void;
}

declare global {
  interface Window {
    __EHT_EMBED__?: boolean | { config?: LiveConfig };
    expoHotToast?: LiveApi;
  }
}

let config: LiveConfig = { position: 'top-center', colorScheme: 'dark' };
const listeners = new Set<() => void>();
let loading: Promise<LiveApi> | undefined;

export function getConfig(): LiveConfig {
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
  loading ??= new Promise<LiveApi>((resolve, reject) => {
    const root = document.getElementById('root');
    const src = root?.dataset.src;
    if (!src) {
      reject(new Error('The library web build is missing; run the playground export first.'));
      return;
    }
    window.__EHT_EMBED__ = { config };
    window.addEventListener('expo-hot-toast:ready', () => resolve(window.expoHotToast!), { once: true });
    const script = document.createElement('script');
    script.src = src;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
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
