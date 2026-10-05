/* Components */
export { Toaster } from './components/toaster';
export type { ToasterProps } from './components/toaster';
export { ToastBar } from './components/toast-bar';
export type { ToastBarProps } from './components/toast-bar';
export { ToastIcon, CloseIcon, TOAST_ICON_ACCENTS } from './components/icons';
export type { ToastIconKind, ToastIconProps } from './components/icons';
export {
  GlassSurface,
  GLASS_SUPPORTED,
  NATIVE_GLASS,
} from './components/glass-surface';
export type {
  GlassSurfaceMode,
  GlassSurfaceProps,
} from './components/glass-surface';

/* Imperative API */
export { toast, default } from './core/toast';
export type { ToastAPI, ToastHandler, PromiseMessages } from './core/toast';

/* Headless hooks, for building a custom renderer */
export {
  useToaster,
  useToasterCleanup,
} from './core/use-toaster';
export type {
  UseToasterOptions,
  UseToasterResult,
  UseToasterCleanupOptions,
} from './core/use-toaster';

export {
  useToasterStore,
  resolveValue,
  getState,
  dispatch,
  dispatchAll,
  subscribe,
  setSettings,
  DEFAULT_TOASTER_ID,
  REMOVE_DELAY,
} from './core/store';
export type { ToasterState, ToasterSettings, Action, ActionType } from './core/store';

/* Theming */
export {
  defaultTheme,
  darkTheme,
  defaultMotion,
  defaultTimeouts,
  mergeTheme,
  resolveTheme,
  useToastTheme,
} from './theme/tokens';
export { toastCssVars, toastCssVarsForScheme, CSS_VAR_PREFIX } from './theme/css-vars';
export type { ToastCssVars } from './theme/css-vars';

/* Accessibility helpers, exposed so consumers can build a custom renderer that
 * respects the same signals. */
export {
  useReduceMotion,
  useReduceTransparency,
  useGlassMode,
  announce,
} from './utils/a11y';
export type { GlassMode } from './utils/a11y';

/* Haptics */
export { triggerToastHaptic } from './utils/haptics';

/* Types */
export type {
  DefaultToastOptions,
  DismissReason,
  GlassConfig,
  MotionConfig,
  Renderable,
  ResolvedTheme,
  Toast,
  ToastOptions,
  ToastPosition,
  ToastTheme,
  ToastThemeOverride,
  ToastType,
  ValueFunction,
  ValueOrFunction,
} from './core/types';