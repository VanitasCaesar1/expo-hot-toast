import { defaultTheme, darkTheme } from './tokens';
import type { ToastTheme } from '../core/types';

/**
 * Emit the token layer as CSS custom properties.
 *
 * This is the seam for NativeWind and Unistyles. Neither needs this library to
 * depend on it: hand the object to `vars()`, a Unistyles `themes` entry, or an
 * inline `style` prop and every value is available by name.
 *
 *   const vars = toastCssVars();
 *   // NativeWind v4
 *   <View style={{ backgroundColor: vars['--eh-toast-bg'] }} />
 *   // or via theme: { colors: { toast: vars } }
 *
 * Numbers are emitted as raw numbers, not strings, because both styling libs
 * accept a plain number for a dimension and will append `px` themselves.
 * Strings pass through untouched so colors stay valid CSS.
 */

const PREFIX = '--eh-toast';

export type ToastCssVars = Record<string, string | number>;

function toKebab(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/** Motion values that map cleanly onto CSS animation declarations. */
function motionVars(theme: ToastTheme): ToastCssVars {
  const { motion } = theme;
  return {
    [`${PREFIX}-motion-queue-shift`]: `${motion.queueShift}ms`,
    [`${PREFIX}-motion-enter`]: `${motion.enter}ms`,
    [`${PREFIX}-motion-exit`]: `${motion.exit}ms`,
    [`${PREFIX}-motion-icon-pop`]: `${motion.iconPop}ms`,
    [`${PREFIX}-motion-icon-pop-delay`]: `${motion.iconPopDelay}ms`,
  };
}

export function toastCssVars(theme: ToastTheme = defaultTheme): ToastCssVars {
  const vars: ToastCssVars = {};

  for (const [key, value] of Object.entries(theme)) {
    if (key === 'motion') continue;
    vars[`${PREFIX}-${toKebab(key)}`] = value as string | number;
  }

  return { ...vars, ...motionVars(theme) };
}

export function toastCssVarsForScheme(scheme: 'light' | 'dark'): ToastCssVars {
  return toastCssVars(scheme === 'dark' ? darkTheme : defaultTheme);
}

export { PREFIX as CSS_VAR_PREFIX };