import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle, TextStyle } from 'react-native';
import type { WithTimingConfig } from 'react-native-reanimated';
import type { GlassStyle } from 'expo-glass-effect';

export type ToastType = 'blank' | 'error' | 'success' | 'loading' | 'custom';

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type Renderable = ReactNode;

export type ValueFunction<T, P> = (props: P) => T;
export type ValueOrFunction<T, P> = T | ValueFunction<T, P>;

/**
 * Options accepted per-toast, and as Toaster-level defaults keyed by type.
 *
 * Diverges from react-hot-toast in three deliberate ways:
 *  - `ariaProps` is replaced by real RN accessibility props.
 *  - `className` is dropped (there is no CSS engine); styling goes through
 *    `style` + the `theme` token layer.
 *  - `removeDelay` survives for API parity but is no longer load-bearing,
 *    because Reanimated owns exit-animation mount retention.
 */
export interface ToastOptions {
  id?: string;
  icon?: Renderable;
  /**
   * `'short'` = 2000, `'long'` = 4500, `'infinite'` never expires.
   *
   * Snackbars have exported `LENGTH_SHORT` / `LENGTH_LONG` / `LENGTH_INDEFINITE`
   * constants for a decade and `@lucaleukert/expo-toast` converged on the same
   * vocabulary independently, so matching it beats inventing a third one. Numbers
   * still work, which keeps react-hot-toast parity.
   */
  duration?: number | DurationPreset;
  /** Per-toast placement. Falls back to the Toaster's `position`. */
  position?: ToastPosition;
  /** Route to a specific mounted Toaster. Defaults to `'default'`. */
  toasterId?: string;
  /** Per-toast position within the stack. Newest renders first unless reversed. */
  reverseOrder?: boolean;

  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconStyle?: StyleProp<ViewStyle>;

  /** Per-toast design token overrides. Merged over the Toaster theme. */
  theme?: ToastThemeOverride;
  /** Per-toast glass override. `false` forces the opaque fallback surface. */
  glass?: boolean | GlassConfig;

  /** iOS announcement string. Defaults to the rendered message. */
  accessibilityLabel?: string;
  dismissOnTap?: boolean;
  /**
   * Render a trailing close button. Off by default to match react-hot-toast,
   * which has no dismiss affordance. Worth enabling for toasts with a long
   * `duration`, or for anything the user may want to clear early on a device
   * where swipe-to-dismiss is not discoverable.
   *
   * Named `closeButton` to match Sonner and sonner-native.
   */
  closeButton?: boolean;
  /** @deprecated Renamed to `closeButton`. */
  closeable?: boolean;
  /** Tint for the close button's glyph. Falls back to the theme colour. */
  closeButtonColor?: string;
  /**
   * Interrupt politely-queued announcements. Errors are assertive by default.
   *
   * Android has a real `accessibilityLiveRegion` so this genuinely changes
   * behaviour there. On iOS it cannot preempt an in-flight announcement, so it
   * is currently advisory.
   */
  important?: boolean;
  /** Fired when the toast leaves the screen, with why. */
  onDismiss?: (id: string, reason: DismissReason) => void;

  /**
   * Suppress this toast if an identical one is already on screen, returning that
   * toast's id instead of creating a second.
   *
   * The fix for a spinner that fires twenty times a second: twenty stacked
   * toasts say nothing, whereas one that transitions in place says a lot.
   */
  dedupeKey?: string;
  /** How long a dedupe hit stays valid, in ms. Default 1000. */
  dedupeWindowMs?: number;

  /** Trailing action, e.g. Undo. */
  action?: ToastAction;
}

export interface ToastAction {
  label: string;
  onPress: () => void;
  /** Overrides the theme's action colour. */
  color?: string;
}

export type DurationPreset = 'short' | 'long' | 'infinite';

export type DefaultToastOptions = ToastOptions & {
  blank?: ToastOptions;
  custom?: ToastOptions;
  error?: ToastOptions;
  loading?: ToastOptions;
  success?: ToastOptions;
};

export interface Toast {
  type: ToastType;
  id: string;
  toasterId?: string;
  message: ValueOrFunction<Renderable, Toast>;
  icon?: Renderable;

  duration?: number;
  /** Original symbolic request, kept for the settings/Toaster layers. */
  durationPreset?: DurationPreset;
  position?: ToastPosition;
  /** Accumulated milliseconds spent paused. Timers re-derive from this. */
  pauseDuration: number;
  /** Effective position once the Toaster default has been applied. */
  resolvedPosition: ToastPosition;
  /** Index within its position stack, front of the stack being 0. */
  depth: number;
  action?: ToastAction;
  dedupeKey?: string;
  createdAt: number;

  visible: boolean;
  dismissed: boolean;
  /** Why it left the screen. First cause wins; it is the informative one. */
  dismissReason?: DismissReason;

  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  theme?: ToastThemeOverride;
  glass?: boolean | GlassConfig;
  accessibilityLabel?: string;
  dismissOnTap?: boolean;
  closeButton?: boolean;
  /** @deprecated Renamed to `closeButton`. */
  closeable?: boolean;
  closeButtonColor?: string;
  important?: boolean;
  onDismiss?: (id: string, reason: DismissReason) => void;

  /** Retained for API parity with react-hot-toast. See note on ToastOptions. */
  removeDelay?: number;
}

/**
 * Why a toast left the screen.
 *
 * `react-native-snackbar` has shipped `DISMISS_EVENT_*` constants since 2016, so
 * the ecosystem agrees a dismiss reason is part of the public API rather than an
 * implementation detail. A bare `dismissed: boolean` cannot distinguish a toast
 * the user swiped away from one that timed out or was evicted by overflow, which
 * are very different things to report upstream.
 */
export type DismissReason =
  | 'timeout'
  | 'swipe'
  | 'tap'
  | 'close'
  | 'overflow'
  | 'programmatic'
  | 'replaced'
  | 'action';

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

export interface MotionConfig {
  /** Sibling push when the queue reflows. rht: 230ms. */
  queueShift: number;
  /** Enter duration. rht: 350ms. */
  enter: number;
  /** Exit duration. rht: 400ms. */
  exit: number;
  /** Icon pop. rht: 300ms with a 120ms delay. */
  iconPop: number;
  iconPopDelay: number;
  /**
   * Milliseconds added to each toast's deadline per stack position.
   *
   * Without it, a stack of three toasts sharing a deadline all vanish on the
   * same frame and the collapse reads as a glitch rather than three separate
   * events. From `@lucaleukert/expo-toast`.
   */
  stagger: number;
  /** Ceiling for the stagger, so a deep stack cannot hold a toast for minutes. */
  staggerMax: number;
  /**
   * rht's overshoot curve — "the hot in react-hot-toast".
   * Typed as whatever `withTiming` accepts, because `Easing.bezier` returns a
   * factory and `Easing.linear` returns a plain function; the union is real.
   */
  enterEasing: NonNullable<WithTimingConfig['easing']>;
  /** Deliberately different from enter: exits decelerate away, they don't bounce. */
  exitEasing: NonNullable<WithTimingConfig['easing']>;
  iconEasing: NonNullable<WithTimingConfig['easing']>;
  /** Enter travel as a fraction of the toast's own height. rht: 0.2. */
  enterTranslate: number;
  /** Exit travel. rht: 0.15 — shallower than enter, on purpose. */
  exitTranslate: number;
  enterScale: number;
  exitScale: number;
}

export interface GlassConfig {
  style?: GlassStyle;
  tintColor?: string;
  /** Sets UIGlassEffect.isInteractive. Only for tappable toasts. */
  interactive?: boolean;
  /**
   * Merge adjacent toasts into one continuous material via UIGlassContainerEffect.
   * This is the feature the web cannot replicate. Default true.
   */
  containerize?: boolean;
  /** GlassContainer spacing in px. Defaults to the Toaster `gutter`. */
  containerSpacing?: number;
}

export interface ToastTheme {
  /** rgba background for the opaque fallback surfaces. */
  background: string;
  /** Opaque fallback for when Liquid Glass is unavailable. */
  fallbackBackground: string;
  border: string;
  color: string;
  radius: number;
  paddingVertical: number;
  paddingHorizontal: number;
  maxWidth: number;
  /** Depth cue on the fallback surface. Ignored by real glass. */
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffsetY: number;
  elevation: number;
  borderWidth: number;
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  /** Circular backdrop behind the close button, so it reads against glass. */
  closeButtonBackground: string;
  gap: number;
  iconSize: number;
  actionColor: string;
  actionPaddingHorizontal: number;
  motion: MotionConfig;
}

export interface ToastThemeOverride extends Partial<Omit<ToastTheme, 'motion'>> {
  motion?: Partial<MotionConfig>;
}

export type ResolvedTheme = ToastTheme;