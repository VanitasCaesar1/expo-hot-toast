/**
 * expo-hot-toast for plain React web apps (Next.js, Vite, any React DOM app),
 * without React Native or React Native Web: `import { toast, Toaster } from
 * 'expo-hot-toast/web'`.
 *
 * The same `toast()` API, store, queue, presets, rich toasts and theme tokens
 * as the native build, rendered with DOM and CSS in the same frosted look. The
 * published bundle is built by `vite.config.web.ts`, which points the core's
 * few React Native imports at the shims in `./shims`.
 */
export { Toaster, ToastBar } from './toaster';
export type { ToasterProps, ToastBarProps, ToastIcons, WebGlassConfig } from './toaster';
export { ToastGlyph, CloseGlyph, ACCENTS as TOAST_ICON_ACCENTS } from './icons';
export type { WebIconKind } from './icons';

export { toast, default } from '../core/toast';
export type {
  ToastAPI,
  ToastHandler,
  PromiseMessages,
  ToastUpdate,
  ProgressController,
  StepsController,
  TrackMessages,
  ShapedOptions,
  NotifyOptions,
} from '../core/toast';

export { useToaster } from '../core/use-toaster';
export type { UseToasterOptions, UseToasterResult } from '../core/use-toaster';
export { useToasterStore, resolveValue, DEFAULT_TOASTER_ID } from '../core/store';

export { defaultTheme, darkTheme, defaultMotion, defaultTimeouts, mergeTheme, resolveTheme, useToastTheme } from '../theme/tokens';
export { themeFromColors } from '../theme/adapters';
export type { ColorTokens } from '../theme/adapters';
export { materialTheme, animationMotion, resolvePreset } from '../core/presets';
export type { ToasterPreset, ToastAnimation } from '../core/presets';
export { toastCssVars, toastCssVarsForScheme, CSS_VAR_PREFIX } from '../theme/css-vars';
export { withAlpha } from '../utils/color';

export type {
  DefaultToastOptions,
  DismissReason,
  DurationPreset,
  IconTheme,
  MotionConfig,
  Renderable,
  Toast,
  ToastAction,
  ToastOptions,
  ToastPosition,
  ToastSlot,
  ToastStyles,
  ToastClassNames,
  ToastVariant,
  ToastExpandable,
  ToastAvatar,
  SwipeDirection,
  ToastTheme,
  ToastThemeOverride,
  ToastType,
  ValueFunction,
  ValueOrFunction,
} from '../core/types';
