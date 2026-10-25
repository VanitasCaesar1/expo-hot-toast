import type { ComponentType, ReactNode } from 'react';
import type { StyleProp, ViewStyle, TextStyle } from 'react-native';
import type { WithTimingConfig } from 'react-native-reanimated';
import type { GlassStyle } from 'expo-glass-effect';

export type ToastType = 'blank' | 'error' | 'success' | 'loading' | 'info' | 'warning' | 'custom';

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
 * Diverges from react-hot-toast in two deliberate ways:
 *  - `ariaProps` is replaced by real RN accessibility props.
 *  - `className` is dropped (there is no CSS engine); styling goes through
 *    `style` + the `theme` token layer.
 */
export interface ToastOptions {
  id?: string;
  /** An element, or a function of the toast that returns one. `null` hides the icon. */
  icon?: ValueOrFunction<Renderable, Toast>;
  /**
   * A second, quieter line under the message, for detail the message does not
   * need: 'Upload failed' / 'Check your connection and try again'.
   */
  description?: Renderable;
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
  /**
   * How long a dismissed toast stays mounted before it is removed, in ms.
   * Defaults to the Toaster's exit duration (`theme.motion.exit`).
   *
   * The exit animation plays inside this window, so a value shorter than it
   * unmounts the toast mid-exit and cuts the animation short. Longer values
   * keep the toast in the store, invisible, after it has finished leaving.
   */
  removeDelay?: number;

  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconStyle?: StyleProp<ViewStyle>;
  /** Colours for the built-in icon. See `IconTheme`. */
  iconTheme?: IconTheme;

  /** Per-toast design token overrides. Merged over the Toaster theme. */
  theme?: ToastThemeOverride;
  /** Per-toast glass override. `false` forces the opaque fallback surface. */
  glass?: boolean | GlassConfig;
  /**
   * Colour success and error toasts by their outcome: a green or red tinted
   * surface and text (`theme.rich`), and a matching tint on Liquid Glass.
   * Other types are unaffected. Default false.
   */
  richColors?: boolean;
  /**
   * The haptic this toast plays when it appears: `true` for its type's default
   * (success, error and warning have one), `false` for none, or a named
   * haptic. `<Toaster haptics>` sets the defaults for a whole Toaster.
   */
  haptics?: boolean | ToastHaptic;

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
  /**
   * A second, quieter button before the action, e.g. Cancel. It dismisses the
   * toast after its `onPress`, like the action.
   */
  cancel?: ToastAction;
  /**
   * Whether the user can dismiss it: by swipe, tap or the close button. Default
   * true. A toast that must stay until code dismisses it (an upload in
   * progress) sets false.
   */
  dismissible?: boolean;
  /**
   * The directions a swipe dismisses toward. Default: sideways to the right,
   * and toward the toast's own edge (up for a top toast, down for a bottom one).
   */
  swipeDirections?: SwipeDirection[];

  /** Styles for each part of the built-in toast. Applied after the tokens. */
  styles?: ToastStyles;
  /**
   * Class names for each part, for NativeWind, Uniwind or any library that
   * reads `className` on React Native components. Ignored without one.
   */
  classNames?: ToastClassNames;
  /**
   * Drop the built-in surface and look: no material, fill, border, shadow or
   * padding, only the layout. For styling every part yourself, through
   * `styles` or `classNames`.
   */
  unstyled?: boolean;
  /**
   * The toast's shape. Default `'auto'`: the Toaster's preset decides (a pill
   * on iOS and the web, a Material snackbar on Android).
   */
  variant?: ToastVariant;

  /**
   * A progress bar, from 0 to 1, or `'indeterminate'`. Usually driven through
   * `toast.progress()`, which updates it without re-rendering the toast.
   */
  progress?: number | 'indeterminate';
  /** Where the progress shows: a bar along the bottom edge, or a ring round the icon. */
  progressStyle?: 'bar' | 'ring';
  /** Divides the progress bar into this many steps, for `toast.steps()`. */
  progressSegments?: number;

  /**
   * Content revealed under the message when the toast is expanded, with a
   * chevron to open and close it: error details, a list of failed files.
   */
  expandable?: ToastExpandable;
  /**
   * An avatar or thumbnail at the start, for notification-style toasts. An
   * image source, or an element.
   */
  avatar?: ToastAvatar;
  /** A short time label at the end of the title line, e.g. 'now' or '2m'. */
  timestamp?: string;
  /** Runs when the toast is tapped, for notification-style toasts that open something. */
  onPress?: () => void;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * A toast's haptic: an impact of some weight, or one of the system's
 * notification patterns. `false` plays nothing.
 */
export type ToastHaptic = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error' | false;

/**
 * - `pill`: hugs its content, rounded; the default on iOS and the web.
 * - `snackbar`: Material 3, full width less a margin, near-square corners;
 *   the default on Android.
 * - `card`: a notification: avatar, title, body, timestamp.
 * - `banner`: full width against the screen edge, for persistent states like
 *   being offline.
 * - `hud`: a large centred confirmation with the icon above the text.
 * - `island`: a black capsule at the top that grows out of the Dynamic Island.
 */
export type ToastVariant = 'auto' | 'pill' | 'snackbar' | 'card' | 'banner' | 'hud' | 'island';

export interface ToastExpandable {
  /** What the expanded toast shows. A string renders as text. */
  content: Renderable;
  /** Start open. Default false. */
  defaultExpanded?: boolean;
  /** Accessible name for the toggle. Default 'Show details'. */
  label?: string;
}

export type ToastAvatar =
  | { uri: string }
  | number
  | Renderable;

/** The built-in toast's parts, for `styles` and `classNames`. */
export type ToastSlot =
  | 'toast'
  | 'content'
  | 'icon'
  | 'title'
  | 'description'
  | 'action'
  | 'actionLabel'
  | 'cancel'
  | 'cancelLabel'
  | 'closeButton'
  | 'progressTrack'
  | 'progressBar'
  | 'avatar'
  | 'timestamp'
  | 'badge'
  | 'expanded';

export type ToastStyles = Partial<Record<ToastSlot, StyleProp<ViewStyle & TextStyle>>>;
export type ToastClassNames = Partial<Record<ToastSlot, string>>;

/**
 * Colours for a toast's icon, as in react-hot-toast.
 *
 * react-hot-toast draws a filled disc (`primary`) with a mark cut out of it
 * (`secondary`). The built-in glyphs here are stroked marks instead, so the two
 * roles do not map one-to-one; see each field.
 */
export interface IconTheme {
  /**
   * Stroke colour of the built-in glyph, and the colour of the loading
   * spinner. Falls back to the per-type accent (TOAST_ICON_ACCENTS), and the
   * spinner to the theme text colour.
   */
  primary: string;
  /**
   * Accepted for react-hot-toast parity only: the built-in glyphs are strokes
   * with no second colour, so they ignore it. It is still carried on
   * `toast.iconTheme`, so a custom `icon` renderer can read it.
   */
  secondary: string;
}

export interface ToastAction {
  label: string;
  onPress: () => void;
  /** Overrides the theme's action colour. */
  color?: string;
  /**
   * Draw a ring beside the label that drains over the time the toast has
   * left, so an Undo shows how long it stays possible. Pauses with the toast.
   */
  countdown?: boolean;
}

export type DurationPreset = 'short' | 'long' | 'infinite';

export type DefaultToastOptions = ToastOptions & {
  blank?: ToastOptions;
  custom?: ToastOptions;
  error?: ToastOptions;
  loading?: ToastOptions;
  success?: ToastOptions;
  info?: ToastOptions;
  warning?: ToastOptions;
};

/**
 * A toast in the store: its options, resolved, plus what the store tracks.
 * Every option a toast accepts is carried as given, so a new option needs
 * declaring once, on `ToastOptions`.
 */
export interface Toast extends Omit<ToastOptions, 'duration' | 'id' | 'icon'> {
  type: ToastType;
  id: string;
  message: ValueOrFunction<Renderable, Toast>;
  /** An element, or a function of the toast that returns one. `null` hides the icon. */
  icon?: ValueOrFunction<Renderable, Toast>;

  duration?: number;
  /** Original symbolic request, kept for the settings/Toaster layers. */
  durationPreset?: DurationPreset;
  /** Accumulated milliseconds spent paused. Timers re-derive from this. */
  pauseDuration: number;
  /** Effective position once the Toaster default has been applied. */
  resolvedPosition: ToastPosition;
  /** Index within its position stack, front of the stack being 0. */
  depth: number;
  createdAt: number;
  /** How many identical calls (by `dedupeKey`) this toast stands for. */
  count?: number;

  visible: boolean;
  /**
   * Still live, but pushed out of the visible slots by newer toasts. A
   * renderer plays its exit, as for a dismissed toast; it returns, entering
   * again, when a slot frees. Set by `useToaster` only.
   */
  queued?: boolean;
  dismissed: boolean;
  /** Why it left the screen. First cause wins; it is the informative one. */
  dismissReason?: DismissReason;
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
   * Put each stack in one GlassContainer (UIGlassContainerEffect), so
   * neighbouring toasts blend when they come within `containerSpacing`.
   * Read from the `<Toaster glass>` setting. Default true.
   */
  containerize?: boolean;
  /** GlassContainer spacing in px. Defaults to the Toaster `gap`. */
  containerSpacing?: number;
}

/**
 * A blur view to draw toasts on where neither Liquid Glass nor the web's frost
 * is available: Android, and iOS before 26. The library does not depend on a
 * blur package; pass the component you already use, with its props:
 *
 * ```tsx
 * import { BlurView } from 'expo-blur';
 * <Toaster blur={{ component: BlurView, props: { intensity: 40, blurMethod: 'dimezisBlurViewSdk31Plus', blurTarget } }} />
 * ```
 *
 * The component is drawn behind the toast's content, filling its shape, with
 * `tint` set to the colour scheme unless `props` sets one, and the translucent
 * `background` token laid over it. Reduce Transparency, and `glass: false` on a
 * toast, still give the opaque surface.
 */
export interface ToastBlur {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  props?: Record<string, unknown>;
}

export interface ToastTheme {
  /**
   * A translucent fill: the frosted glass drawn on the web, and a fill for
   * custom renderers and the CSS variable export. Liquid Glass has its own
   * material, and the opaque surface uses `fallbackBackground`.
   */
  background: string;
  /** Fill of the opaque surface used when Liquid Glass is unavailable. Keep it opaque. */
  fallbackBackground: string;
  border: string;
  color: string;
  radius: number;
  paddingVertical: number;
  paddingHorizontal: number;
  maxWidth: number;
  /** Backdrop blur of the frosted glass drawn on the web, in px. */
  frostBlur: number;
  /** Saturation of the blurred backdrop on the web, in percent. */
  frostSaturation: number;
  /** Light caught in the frosted glass rim on the web. */
  frostHighlight: string;
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
  /**
   * The message's font. Undefined uses the system font. On Android, where a
   * custom font is a family per weight, give the family for `fontWeight`.
   */
  fontFamily?: string;
  /** The description's font. Defaults to `fontFamily`. */
  descriptionFontFamily?: string;
  /** The action and cancel buttons' font. Defaults to `fontFamily`. */
  actionFontFamily?: string;
  /** Lines the message may take before it is cut off. Default 3. */
  maxLines: number;
  /** Lines the description may take. Default 3. */
  descriptionMaxLines: number;
  /**
   * Stretch to the stack's width (less `offset`) instead of hugging the
   * content. On for the Material snackbar and the banner.
   */
  fill: boolean;
  /** The `description` line under the message. */
  descriptionColor: string;
  descriptionFontSize: number;
  descriptionLineHeight: number;
  /**
   * Cap on Dynamic Type / font scale for toast text. A toast is capped at three
   * lines, so at the largest accessibility sizes an uncapped message is cut
   * off rather than enlarged. `null` removes the cap.
   */
  maxFontSizeMultiplier: number | null;
  /** Circular backdrop behind the close button, so it reads against glass. */
  closeButtonBackground: string;
  gap: number;
  iconSize: number;
  actionColor: string;
  actionPaddingHorizontal: number;
  /** Outcome colours for toasts with `richColors`. */
  rich: RichPalette;
  motion: MotionConfig;
}

/** One outcome's colours under `richColors`. */
export interface RichColors {
  /** Fill of the opaque surface. */
  background: string;
  border: string;
  /** Message and description text. */
  color: string;
  /** Tint laid over Liquid Glass. */
  tint: string;
}

export interface RichPalette {
  success: RichColors;
  error: RichColors;
  info: RichColors;
  warning: RichColors;
}

export interface ToastThemeOverride extends Partial<Omit<ToastTheme, 'motion' | 'rich'>> {
  motion?: Partial<MotionConfig>;
  rich?: { [K in keyof RichPalette]?: Partial<RichColors> };
}

export type ResolvedTheme = ToastTheme;