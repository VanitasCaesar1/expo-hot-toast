import * as React from 'react';
import { useToaster } from '../core/use-toaster';
import { resolveValue } from '../core/store';
import { toast as toastApi } from '../core/toast';
import { dropProgress, progressValue } from '../core/progress';
import { animationMotion, materialTheme, resolvePreset, resolveVariant, variantMotion, variantTheme } from '../core/presets';
import type { ToastAnimation, ToasterPreset } from '../core/presets';
import { mergeTheme, useToastTheme } from '../theme/tokens';
import { withAlpha } from '../utils/color';
import type {
  DefaultToastOptions,
  DismissReason,
  SwipeDirection,
  Toast,
  ToastPosition,
  ToastSlot,
  ToastTheme,
  ToastThemeOverride,
  ToastType,
} from '../core/types';
import { cssEasing } from './shims/reanimated';
import type { Mutable } from './shims/reanimated';
import { css, STYLE_ID } from './styles';
import { ACCENTS, ChevronGlyph, CloseGlyph, ToastGlyph } from './icons';
import type { WebIconKind } from './icons';
import { Avatar, CountdownRing, ProgressBar, ProgressPercent, ProgressRing, cx, flatten } from './parts';

/** Icons for each type, and the close button, in place of the built-in glyphs. */
export type ToastIcons = Partial<Record<Exclude<ToastType, 'custom'> | 'close', React.ReactNode>>;

export interface WebGlassConfig {
  /** A tint laid over the frosted glass. */
  tintColor?: string;
  /** `'none'` draws the opaque surface. */
  style?: 'regular' | 'clear' | 'none';
}

export interface ToasterProps {
  /** For toasts that name no position. Default `'top-center'` (`'bottom-center'` with the Material preset). */
  position?: ToastPosition;
  /** Newest at the far end of the stack instead of the anchored edge. */
  reverseOrder?: boolean;
  /** Space between toasts, in px. Default 14. */
  gap?: number;
  /** Distance from the edge of the viewport, in px. Default 16. */
  offset?: number;
  toastOptions?: DefaultToastOptions;
  theme?: ToastThemeOverride;
  /** Forces light or dark tokens. Default: the system appearance. */
  colorScheme?: 'light' | 'dark';
  /** Frosted glass where the browser can blur a backdrop. `false` draws the opaque surface. Default true. */
  glass?: boolean | WebGlassConfig;
  /** `'auto'` and `'glass'` draw the frosted pill; `'material'` a Material 3 snackbar. */
  preset?: ToasterPreset;
  animation?: ToastAnimation;
  icons?: ToastIcons;
  visibleToasts?: number;
  /** Deprecated alias for `visibleToasts`. */
  toastLimit?: number;
  maxPending?: number;
  dropPolicy?: 'oldest' | 'newest';
  toasterId?: string;
  /** Drag distance that dismisses, in px. 0 turns swiping off. Default 72. */
  panThreshold?: number;
  /** Pause every timer, for example while a dialog is open. */
  paused?: boolean;
  /** Pause every timer while the pointer is over a toast, as react-hot-toast does. Default true. */
  pauseOnHover?: boolean;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
  /** Draw each toast yourself. Receives the toast; return any element. */
  children?: (toast: Toast) => React.ReactNode;
}

type Bucket = ToastPosition | 'center' | 'island' | 'banner-top' | 'banner-bottom';
const BUCKETS: Bucket[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right', 'center', 'island', 'banner-top', 'banner-bottom'];

function bucketOf(t: Toast, position: ToastPosition, preset: 'glass' | 'material'): Bucket {
  const at = t.position ?? position;
  switch (resolveVariant(t.variant, preset)) {
    case 'hud':
      return 'center';
    case 'island':
      return 'island';
    case 'banner':
      return at.startsWith('bottom') ? 'banner-bottom' : 'banner-top';
    default:
      return at;
  }
}

const SAFE = {
  top: 'env(safe-area-inset-top, 0px)',
  bottom: 'env(safe-area-inset-bottom, 0px)',
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
};

/**
 * Where a stack sits, and how its toasts line up inside it. Stacks span the
 * width between their side offsets, so a filling toast (a snackbar, a banner)
 * can take it all; the rest align left, centre or right within it.
 */
function stackLayout(bucket: Bucket, offset: number): { style: React.CSSProperties; justify: string } {
  const sides = { left: `calc(${SAFE.left} + ${offset}px)`, right: `calc(${SAFE.right} + ${offset}px)` };
  const avail = { '--eht-avail': `calc(100vw - ${offset * 2}px)` } as React.CSSProperties;
  switch (bucket) {
    case 'banner-top':
      return { style: { top: 0, left: 0, right: 0 }, justify: 'stretch' };
    case 'banner-bottom':
      return { style: { bottom: 0, left: 0, right: 0 }, justify: 'stretch' };
    case 'center':
      return { style: { ...sides, ...avail, top: 0, bottom: 0, justifyContent: 'center' }, justify: 'center' };
    case 'island':
      return { style: { ...sides, ...avail, top: `calc(${SAFE.top} + 8px)` }, justify: 'center' };
    default: {
      const vertical = bucket.startsWith('top') ? { top: `calc(${SAFE.top} + ${offset}px)` } : { bottom: `calc(${SAFE.bottom} + ${offset}px)` };
      const justify = bucket.endsWith('left') ? 'flex-start' : bucket.endsWith('right') ? 'flex-end' : 'center';
      return { style: { ...sides, ...avail, ...vertical }, justify };
    }
  }
}

// --- Platform facts ----------------------------------------------------------

const FROST =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));

function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (callback) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', callback);
      return () => list.removeEventListener('change', callback);
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  );
}

// --- Surfaces ----------------------------------------------------------------

function fade(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(percent)}%, transparent)`;
}

/** Frosted glass: the web rung, the same recipe as the React Native Web build. */
function frostStyle(theme: ToastTheme, tint: string | undefined): React.CSSProperties {
  const filter = `blur(${theme.frostBlur}px) saturate(${theme.frostSaturation}%)`;
  const light = theme.frostHighlight;
  return {
    background: tint ? `linear-gradient(${tint}, ${tint}), ${theme.background}` : theme.background,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
    boxShadow: [
      `inset 0 0 0 1px ${theme.border}`,
      `inset 0 0 12px -4px ${fade(light, 60)}`,
      `inset 1.5px 2.5px 1px -2px ${fade(light, 70)}`,
      `inset -1.5px -2px 1px -2px ${fade(light, 50)}`,
      'inset 2px 0 3px -1px rgb(80 160 255 / 0.06)',
      'inset -2px 0 3px -1px rgb(255 90 150 / 0.06)',
      `0 ${theme.shadowOffsetY}px ${theme.shadowRadius * 2}px ${fade(theme.shadowColor, theme.shadowOpacity * 100)}`,
    ].join(', '),
  };
}

function opaqueStyle(theme: ToastTheme): React.CSSProperties {
  return {
    background: theme.fallbackBackground,
    boxShadow: [
      theme.borderWidth > 0 || theme.border !== 'transparent' ? `inset 0 0 0 ${Math.max(theme.borderWidth, 1)}px ${theme.border}` : '',
      `0 ${theme.shadowOffsetY}px ${theme.shadowRadius * 2}px ${fade(theme.shadowColor, theme.shadowOpacity * 100)}`,
    ]
      .filter(Boolean)
      .join(', '),
  };
}

// --- The bar -----------------------------------------------------------------

export interface ToastBarProps {
  toast: Toast;
  /** Default: from the Toaster. */
  theme?: ToastTheme;
  preset?: 'glass' | 'material';
  icons?: ToastIcons;
  glass?: boolean | WebGlassConfig;
  /** Fired with the reason when the toast should leave. Default: dismisses it. */
  onDismiss?: (id: string, reason: DismissReason) => void;
  onPauseStart?: () => void;
  onPauseEnd?: () => void;
  atTop?: boolean;
  paused?: boolean;
  panThreshold?: number;
  pauseOnHover?: boolean;
  /** Replace the contents, keeping the surface, gestures and motion. */
  children?: (parts: { icon: React.ReactNode; message: React.ReactNode; description?: React.ReactNode }) => React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/** An event's time in ms. React reports a zero `timeStamp` as missing, so fall back to the clock. */
function now(e: { timeStamp: number }): number {
  return e.timeStamp > 0 ? e.timeStamp : typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Velocity at release, in px/s, over the last ~100ms of movement, as gesture
 * handlers on a phone measure it: a slow drag that ends in a flick is a flick.
 */
function releaseVelocity(samples: Array<{ t: number; x: number; y: number }>, end: { t: number; x: number; y: number }): { vx: number; vy: number } {
  let start = samples[0] ?? end;
  for (const sample of samples) if (end.t - sample.t <= 100) {
    start = sample;
    break;
  }
  const seconds = Math.max((end.t - start.t) / 1000, 0.016);
  return { vx: (end.x - start.x) / seconds, vy: (end.y - start.y) / seconds };
}

function resist(raw: number, allowPositive: boolean, allowNegative: boolean): number {
  const allowed = raw >= 0 ? allowPositive : allowNegative;
  return allowed ? raw : raw * 0.35 * (1 / (1 + Math.abs(raw) * 0.02));
}

const ToastBarContext = React.createContext<Partial<ToastBarProps> | null>(null);

export const ToastBar = React.memo(function ToastBar(props: ToastBarProps) {
  const ctx = React.useContext(ToastBarContext) ?? {};
  const { toast } = props;
  const fallbackTheme = useToastTheme();
  const toasterTheme = props.theme ?? ctx.theme ?? fallbackTheme;
  const preset = props.preset ?? ctx.preset ?? 'glass';
  const icons = props.icons ?? ctx.icons;
  const glassSetting = toast.glass ?? props.glass ?? ctx.glass ?? true;
  const onDismiss = props.onDismiss ?? ctx.onDismiss ?? ((id: string, reason: DismissReason) => toastApi.dismiss(id, undefined, reason));
  const onPauseStart = props.onPauseStart ?? ctx.onPauseStart;
  const onPauseEnd = props.onPauseEnd ?? ctx.onPauseEnd;
  const atTop = props.atTop ?? ctx.atTop ?? (toast.position ?? 'top-center').startsWith('top');
  const paused = props.paused ?? ctx.paused ?? false;
  const panThreshold = props.panThreshold ?? ctx.panThreshold ?? 72;
  const pauseOnHover = props.pauseOnHover ?? ctx.pauseOnHover ?? true;

  const variant = resolveVariant(toast.variant, preset);
  const theme = React.useMemo(() => {
    const tokens = variantTheme(variant);
    return tokens ? mergeTheme(toasterTheme, tokens) : toasterTheme;
  }, [toasterTheme, variant]);

  const reduceTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const glassConfig: WebGlassConfig = typeof glassSetting === 'object' ? (glassSetting as WebGlassConfig) : {};
  const wantsGlass = glassSetting !== false && glassConfig.style !== 'none' && variant !== 'island';
  const frosted = wantsGlass && FROST && !reduceTransparency;

  const type = toast.type;
  const rich = toast.richColors && (type === 'success' || type === 'error' || type === 'info' || type === 'warning') ? theme.rich[type] : undefined;
  const color = rich?.color ?? theme.color;
  const descriptionColor = rich ? withAlpha(rich.color, 0.82) : theme.descriptionColor;
  const unstyled = toast.unstyled === true;
  const hud = variant === 'hud';

  const slot = (part: ToastSlot) => flatten(toast.styles?.[part]);
  const slotClass = (part: ToastSlot) => toast.classNames?.[part];

  // Progress
  const progress = toast.progress !== undefined ? (progressValue(toast.id) as unknown as Mutable<number>) : undefined;
  React.useEffect(() => {
    if (toast.progress === undefined) return;
    progressValue(toast.id).value = toast.progress === 'indeterminate' ? -1 : Math.min(Math.max(toast.progress, 0), 1);
  }, [toast.id, toast.progress]);
  const ring = !!progress && toast.progressStyle === 'ring';
  const accent = toast.iconTheme?.primary ?? (rich ? rich.color : theme.actionColor);

  // Icon
  const message = resolveValue(toast.message, toast);
  const description = toast.description;
  const customIcon = typeof toast.icon === 'function' ? (toast.icon as (t: Toast) => React.ReactNode)(toast) : toast.icon;
  const iconKind: WebIconKind | null = type === 'custom' ? null : (type as WebIconKind);
  const setIcon = iconKind ? icons?.[iconKind as keyof ToastIcons] : undefined;
  const hideSpinner = !!progress && !ring && type === 'loading';
  let icon: React.ReactNode = null;
  if (toast.avatar !== undefined) {
    icon = <Avatar avatar={toast.avatar} size={variant === 'card' ? 40 : 28} style={slot('avatar')} />;
  } else if (ring && progress) {
    icon = <ProgressRing progress={progress} size={theme.iconSize + 4} color={accent} trackColor={withAlpha(theme.color, 0.16)} />;
  } else if (toast.icon !== null) {
    const glyph =
      customIcon ?? setIcon ?? (iconKind && !hideSpinner && iconKind !== 'blank' ? (
        <ToastGlyph kind={iconKind} size={theme.iconSize} color={toast.iconTheme?.primary ?? (rich && iconKind !== 'loading' ? rich.color : undefined)} />
      ) : null);
    if (glyph != null) {
      icon = (
        <span
          key={type}
          className={cx('eht-icon', slotClass('icon'))}
          data-pop={typeof customIcon === 'string' || (!customIcon && !setIcon) ? '' : undefined}
          style={{ width: theme.iconSize, height: theme.iconSize, fontSize: theme.iconSize * 0.9, ...flatten(toast.iconStyle), ...slot('icon') }}
        >
          {glyph}
        </span>
      );
    }
  }

  // Expandable: an open toast holds the queue while it is read.
  const expandable = toast.expandable;
  const [expanded, setExpanded] = React.useState(expandable?.defaultExpanded ?? false);
  const pauseRef = React.useRef({ onPauseStart, onPauseEnd });
  pauseRef.current = { onPauseStart, onPauseEnd };
  React.useEffect(() => {
    if (!expanded) return undefined;
    pauseRef.current.onPauseStart?.();
    return () => pauseRef.current.onPauseEnd?.();
  }, [expanded]);

  const textBase: React.CSSProperties = {
    color,
    fontSize: theme.fontSize,
    lineHeight: `${theme.lineHeight}px`,
    fontWeight: theme.fontWeight as React.CSSProperties['fontWeight'],
    fontFamily: theme.fontFamily,
  };
  const titleLine = (
    <div className="eht-title-line">
      <p
        className={cx('eht-title', slotClass('title'))}
        style={{ ...textBase, WebkitLineClamp: theme.maxLines || undefined, textAlign: hud ? 'center' : undefined, ...flatten(toast.textStyle), ...slot('title') }}
      >
        {message}
      </p>
      {toast.count && toast.count > 1 ? (
        <span className={cx('eht-badge', slotClass('badge'))} style={{ color, background: withAlpha(color, 0.12), ...slot('badge') }} aria-label={`${toast.count} times`}>
          ×{toast.count}
        </span>
      ) : null}
      {toast.timestamp ? (
        <span className={cx('eht-timestamp', slotClass('timestamp'))} style={{ color: descriptionColor, ...slot('timestamp') }}>
          {toast.timestamp}
        </span>
      ) : null}
      {progress && !ring && !hud ? <ProgressPercent progress={progress} style={{ color: descriptionColor }} /> : null}
    </div>
  );
  const texts =
    message == null && description == null ? null : (
      <div className="eht-texts" style={hud ? { alignItems: 'center' } : undefined}>
        {titleLine}
        {description != null ? (
          <p
            className={cx('eht-description', slotClass('description'))}
            style={{
              color: descriptionColor,
              fontSize: theme.descriptionFontSize,
              lineHeight: `${theme.descriptionLineHeight}px`,
              fontFamily: theme.descriptionFontFamily ?? theme.fontFamily,
              WebkitLineClamp: theme.descriptionMaxLines || undefined,
              textAlign: hud ? 'center' : undefined,
              ...slot('description'),
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
    );

  const button = (kind: 'action' | 'cancel', spec: NonNullable<Toast['action']>) => (
    <button
      key={kind}
      type="button"
      className={cx('eht-button', slotClass(kind))}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        spec.onPress();
        onDismiss(toast.id, 'action');
      }}
      style={{
        color: kind === 'cancel' ? color : (spec.color ?? theme.actionColor),
        paddingLeft: theme.actionPaddingHorizontal,
        paddingRight: theme.actionPaddingHorizontal,
        fontSize: theme.fontSize,
        fontFamily: theme.actionFontFamily ?? theme.fontFamily,
        fontWeight: kind === 'cancel' ? (theme.fontWeight as React.CSSProperties['fontWeight']) : 600,
        background: kind === 'cancel' ? withAlpha(theme.color, 0.08) : undefined,
        ...slot(kind),
      }}
    >
      {kind === 'action' && spec.countdown && Number.isFinite(toast.duration) ? (
        <CountdownRing
          key={toast.duration}
          remaining={Math.max((toast.duration ?? 0) + toast.pauseDuration - (Date.now() - toast.createdAt), 0)}
          total={toast.duration ?? 0}
          paused={paused}
          size={16}
          color={spec.color ?? theme.actionColor}
        />
      ) : null}
      <span className={slotClass(kind === 'action' ? 'actionLabel' : 'cancelLabel')} style={slot(kind === 'action' ? 'actionLabel' : 'cancelLabel')}>
        {spec.label}
      </span>
    </button>
  );

  const closeable = toast.closeButton ?? (toast as { closeable?: boolean }).closeable ?? false;
  const toggle = expandable ? (
    <button
      key="expand"
      type="button"
      className="eht-close"
      aria-expanded={expanded}
      aria-label={expandable.label ?? (expanded ? 'Hide details' : 'Show details')}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((open) => !open);
      }}
      style={{ background: theme.closeButtonBackground }}
    >
      <ChevronGlyph open={expanded} color={theme.color} />
    </button>
  ) : null;
  const close = closeable ? (
    <button
      key="close"
      type="button"
      className={cx('eht-close', slotClass('closeButton'))}
      aria-label="Dismiss"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDismiss(toast.id, 'close');
      }}
      style={{ background: theme.closeButtonBackground, ...slot('closeButton') }}
    >
      {icons?.close ?? <CloseGlyph size={15} color={toast.closeButtonColor ?? theme.color} />}
    </button>
  ) : null;
  const buttons = [toggle, toast.cancel ? button('cancel', toast.cancel) : null, toast.action ? button('action', toast.action) : null, close].filter(Boolean);

  const row = hud ? (
    <div className={cx('eht-hud', slotClass('content'))} style={slot('content')}>
      {icon}
      {texts}
      {buttons.length ? <div className="eht-hud-buttons">{buttons}</div> : null}
    </div>
  ) : (
    <div className={cx('eht-row', slotClass('content'))} style={{ gap: theme.gap, ...slot('content') }}>
      {icon}
      {texts}
      {buttons}
    </div>
  );
  const built = expandable ? (
    <div className="eht-column">
      {row}
      {expanded ? (
        <div className={cx('eht-expanded', slotClass('expanded'))} style={{ borderTopColor: withAlpha(theme.color, 0.12), ...slot('expanded') }}>
          {typeof expandable.content === 'string' ? (
            <p style={{ margin: 0, color: descriptionColor, fontSize: theme.descriptionFontSize, lineHeight: `${theme.descriptionLineHeight}px`, fontFamily: theme.descriptionFontFamily ?? theme.fontFamily }}>
              {expandable.content}
            </p>
          ) : (
            (expandable.content as React.ReactNode)
          )}
        </div>
      ) : null}
    </div>
  ) : (
    row
  );
  const content = props.children ? props.children({ icon, message, description }) : built;

  // The surface follows its content's size, so a toast whose message or state
  // changes grows and shrinks smoothly instead of jumping.
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize?.[0];
      const width = box ? box.inlineSize : el.offsetWidth;
      const height = box ? box.blockSize : el.offsetHeight;
      setSize((prev) => (prev && Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5 ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fill = theme.fill;
  const tint = rich ? rich.tint : glassConfig.tintColor;
  const surface: React.CSSProperties = unstyled
    ? {}
    : frosted
      ? frostStyle(rich ? { ...theme, background: rich.background ? withAlpha(rich.background, 0.78) : theme.background } : theme, tint)
      : opaqueStyle(rich ? { ...theme, fallbackBackground: rich.background, border: rich.border } : theme);

  // Swipe, tap and pause.
  const toastRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    id: number;
    x: number;
    y: number;
    axis: 0 | 1 | 2;
    dx: number;
    dy: number;
    /** Recent positions, for the release velocity. */
    samples: Array<{ t: number; x: number; y: number }>;
  } | null>(null);
  // Set once a press becomes a drag, so the click that follows the release is
  // not also taken as a tap.
  const dragged = React.useRef(false);
  const dismissible = toast.dismissible !== false;
  const directions: SwipeDirection[] =
    toast.swipeDirections ?? (variant === 'snackbar' ? ['left', 'right'] : [typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'left' : 'right', atTop ? 'up' : 'down']);
  const allow = { right: directions.includes('right'), left: directions.includes('left'), up: directions.includes('up'), down: directions.includes('down') };
  const tapToDismiss = dismissible && (toast.dismissOnTap ?? false);

  const writeDrag = (dx: number, dy: number) => {
    const el = toastRef.current?.parentElement;
    if (el) el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${(dx / 40) * 4}deg)`;
  };
  const release = (dismiss: boolean, dx: number, dy: number, axis: 1 | 2) => {
    const el = toastRef.current?.parentElement;
    if (!el) return;
    if (dismiss) {
      const sign = Math.sign(axis === 1 ? dx : dy) || 1;
      const height = toastRef.current?.offsetHeight ?? 60;
      el.style.transition = `transform ${theme.motion.exit}ms ${cssEasing(theme.motion.exitEasing)}, opacity ${theme.motion.exit}ms ${cssEasing(theme.motion.exitEasing)}`;
      el.style.transform = axis === 1 ? `translate3d(${dx + sign * 500}px, 0, 0) rotate(${((dx + sign * 500) / 40) * 4}deg)` : `translate3d(0, ${dy + sign * (height + 160)}px, 0)`;
      el.style.opacity = '0';
      onDismiss(toast.id, 'swipe');
    } else {
      el.style.transition = `transform 200ms ${cssEasing(theme.motion.enterEasing)}`;
      el.style.transform = '';
      window.setTimeout(() => {
        if (el.style.transform === '') el.style.transition = '';
      }, 220);
    }
  };

  const handlers: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      dragged.current = false;
      if (e.pointerType !== 'mouse' || !pauseOnHover) onPauseStart?.();
      if (!dismissible || panThreshold <= 0) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: 0, dx: 0, dy: 0, samples: [{ t: now(e), x: e.clientX, y: e.clientY }] };
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const rawX = e.clientX - d.x;
      const rawY = e.clientY - d.y;
      d.samples.push({ t: now(e), x: e.clientX, y: e.clientY });
      if (d.samples.length > 8) d.samples.shift();
      if (d.axis === 0) {
        if (Math.abs(rawX) < 12 && Math.abs(rawY) < 12) return;
        d.axis = Math.abs(rawX) >= Math.abs(rawY) ? 1 : 2;
        dragged.current = true;
        toastRef.current?.setPointerCapture(e.pointerId);
        toastRef.current?.setAttribute('data-dragging', '');
        const el = toastRef.current?.parentElement;
        if (el) el.style.transition = 'none';
      }
      if (d.axis === 1) d.dx = resist(rawX, allow.right, allow.left);
      else d.dy = resist(rawY, allow.down, allow.up);
      writeDrag(d.dx, d.dy);
    },
    onPointerUp: (e) => {
      if (e.pointerType !== 'mouse' || !pauseOnHover) onPauseEnd?.();
      const d = drag.current;
      drag.current = null;
      toastRef.current?.removeAttribute('data-dragging');
      if (!d || d.axis === 0) return;
      const { vx, vy } = releaseVelocity(d.samples, { t: now(e), x: e.clientX, y: e.clientY });
      if (d.axis === 1) {
        const velocity = vx;
        const sign = Math.sign(d.dx);
        const allowed = sign > 0 ? allow.right : allow.left;
        release(allowed && (Math.abs(d.dx) > panThreshold || Math.abs(velocity) > 900), d.dx, d.dy, 1);
      } else {
        const velocity = vy;
        const sign = Math.sign(d.dy);
        const allowed = sign > 0 ? allow.down : allow.up;
        release(allowed && (Math.abs(d.dy) > Math.min(panThreshold, 44) || Math.abs(velocity) > 600), d.dx, d.dy, 2);
      }
    },
    onPointerCancel: () => {
      onPauseEnd?.();
      const d = drag.current;
      drag.current = null;
      toastRef.current?.removeAttribute('data-dragging');
      if (d && d.axis !== 0) release(false, 0, 0, d.axis);
    },
    onPointerEnter: (e) => {
      if (e.pointerType === 'mouse' && pauseOnHover) onPauseStart?.();
    },
    onPointerLeave: (e) => {
      if (e.pointerType === 'mouse' && pauseOnHover) onPauseEnd?.();
    },
    onClick: () => {
      if (dragged.current) return;
      if (toast.onPress) {
        toast.onPress();
        onDismiss(toast.id, 'tap');
      } else if (tapToDismiss) {
        onDismiss(toast.id, 'tap');
      }
    },
  };

  const assertive = toast.important ?? type === 'error';
  const hasButtons = buttons.length > 0;
  return (
    <div
      ref={toastRef}
      className={cx('eht-toast', props.className ?? (toast as { className?: string }).className, slotClass('toast'))}
      data-type={type}
      data-variant={variant}
      data-pressable={toast.onPress || tapToDismiss ? '' : undefined}
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic={!hasButtons}
      aria-label={!hasButtons ? (toast.accessibilityLabel ?? undefined) : undefined}
      {...handlers}
      style={{
        ...surface,
        borderRadius: unstyled ? undefined : theme.radius,
        width: fill ? '100%' : size ? size.width : undefined,
        height: size ? size.height : undefined,
        maxWidth: fill ? theme.maxWidth : undefined,
        '--eht-font': theme.fontFamily,
        '--eht-morph': size ? undefined : '0ms',
        ...flatten(toast.style),
        ...props.style,
        ...slot('toast'),
      } as React.CSSProperties}
    >
      <div
        ref={contentRef}
        className="eht-content"
        data-fill={fill ? '' : undefined}
        style={{
          // Each side on its own: React clears a side given as undefined next to
          // the shorthand, which dropped the bottom padding.
          paddingTop: unstyled ? 0 : theme.paddingVertical,
          paddingBottom: unstyled ? 0 : theme.paddingVertical + (progress && !ring ? 6 : 0),
          paddingLeft: unstyled ? 0 : theme.paddingHorizontal,
          paddingRight: unstyled ? 0 : theme.paddingHorizontal,
          maxWidth: fill ? undefined : `min(${theme.maxWidth}px, var(--eht-avail, 100vw))`,
        }}
      >
        {content}
      </div>
      {progress && !ring ? (
        <ProgressBar
          progress={progress}
          color={accent}
          trackColor={withAlpha(theme.color, 0.12)}
          segments={toast.progressSegments}
          style={hud ? { left: 26, right: 26, bottom: 14, borderRadius: 2 } : slot('progressTrack')}
          barStyle={slot('progressBar')}
          className={slotClass('progressTrack')}
          barClassName={slotClass('progressBar')}
        />
      ) : null}
    </div>
  );
});

// --- One toast's place in a stack ----------------------------------------------

function ToastItem({
  toast,
  atTop,
  gap,
  motion,
  justify,
  render,
}: {
  toast: Toast;
  atTop: boolean;
  gap: number;
  motion: ToastTheme['motion'];
  justify: string;
  render: React.ReactNode;
}) {
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    // Two frames: the first paints the start state, the second starts the move.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  const state = !toast.visible ? 'leaving' : entered ? 'visible' : 'entering';
  const direction = atTop ? -1 : 1;
  const vars = {
    '--eht-enter': `${motion.enter}ms`,
    '--eht-exit': `${motion.exit}ms`,
    '--eht-shift': `${motion.queueShift}ms`,
    '--eht-enter-ease': cssEasing(motion.enterEasing),
    '--eht-exit-ease': cssEasing(motion.exitEasing),
    '--eht-icon-pop': `${motion.iconPop}ms`,
    '--eht-icon-delay': `${motion.iconPopDelay}ms`,
    '--eht-icon-ease': cssEasing(motion.iconEasing),
    '--eht-from-y': `${direction * motion.enterTranslate * 100}%`,
    '--eht-to-y': `${direction * motion.exitTranslate * 100}%`,
    '--eht-from-scale': motion.enterScale,
    '--eht-to-scale': motion.exitScale,
    [atTop ? 'marginBottom' : 'marginTop']: gap,
  } as React.CSSProperties;
  return (
    <div className="eht-item" data-state={state} style={vars}>
      <div className="eht-clip">
        <div className="eht-motion" style={{ justifyContent: justify }}>
          {render}
        </div>
      </div>
    </div>
  );
}

// --- The Toaster ---------------------------------------------------------------

export function Toaster({
  position: positionProp,
  reverseOrder = false,
  gap = 14,
  offset = 16,
  toastOptions,
  theme: themeOverride,
  colorScheme,
  glass = true,
  preset: presetProp = 'auto',
  animation,
  icons,
  visibleToasts,
  toastLimit,
  maxPending,
  dropPolicy,
  toasterId,
  panThreshold = 72,
  paused: pausedProp,
  pauseOnHover = true,
  containerStyle,
  containerClassName,
  children,
}: ToasterProps) {
  const preset = resolvePreset(presetProp);
  const position: ToastPosition = positionProp ?? (preset === 'material' ? 'bottom-center' : 'top-center');
  const system = useMediaQuery('(prefers-color-scheme: dark)') ? 'dark' : 'light';
  const scheme = colorScheme ?? system;
  const layered = React.useMemo(() => {
    const base = preset === 'material' ? materialTheme(scheme) : undefined;
    const motion = animationMotion(animation);
    if (!base && !motion) return themeOverride;
    return { ...base, ...themeOverride, motion: { ...motion, ...themeOverride?.motion } } as ToastThemeOverride;
  }, [preset, scheme, animation, themeOverride]);
  const theme = useToastTheme(layered, scheme);

  const { toasts, startPause, endPause, paused } = useToaster({
    toastOptions,
    toasterId,
    visibleToasts,
    toastLimit,
    maxPending,
    dropPolicy,
    defaultPosition: position,
    paused: pausedProp,
    exitDuration: theme.motion.exit,
    motion: theme.motion,
  });

  // Progress values are forgotten once their toast has gone.
  const seen = React.useRef(new Set<string>());
  React.useEffect(() => {
    const live = new Set(toasts.map((t) => t.id));
    seen.current.forEach((id) => {
      if (!live.has(id)) {
        dropProgress(id);
        seen.current.delete(id);
      }
    });
    live.forEach((id) => seen.current.add(id));
  }, [toasts]);

  const onDismiss = React.useCallback((id: string, reason: DismissReason) => toastApi.dismiss(id, toasterId, reason), [toasterId]);

  const themes = React.useRef(new Map<string, ToastTheme>());
  const themeFor = (t: Toast): { theme: ToastTheme; motion: ToastTheme['motion'] } => {
    const variant = resolveVariant(t.variant, preset);
    const vm = variantMotion(variant);
    if (!t.theme && !vm) return { theme, motion: theme.motion };
    const key = JSON.stringify([t.theme ?? null, variant]);
    let resolved = themes.current.get(key);
    if (!resolved) {
      resolved = mergeTheme(theme, { ...(t.theme ?? {}), motion: { ...vm, ...t.theme?.motion } });
      themes.current.set(key, resolved);
    }
    return { theme: resolved, motion: resolved.motion };
  };
  React.useEffect(() => themes.current.clear(), [theme]);

  const grouped = new Map<Bucket, Toast[]>();
  for (const t of toasts) {
    const b = bucketOf(t, position, preset);
    const list = grouped.get(b);
    if (list) list.push(t);
    else grouped.set(b, [t]);
  }

  return (
    <>
      <style href={STYLE_ID} precedence="default">
        {css}
      </style>
      <div className={cx('eht-root', containerClassName)} style={containerStyle} data-expo-hot-toast="">
        {BUCKETS.map((bucket) => {
          const list = grouped.get(bucket);
          if (!list?.length) return null;
          const anchoredTop = bucket === 'banner-bottom' ? false : bucket.startsWith('bottom') ? false : true;
          const layout = stackLayout(bucket, offset);
          return (
            <div
              key={bucket}
              className="eht-stack"
              data-position={bucket}
              style={{ ...layout.style, flexDirection: anchoredTop === !reverseOrder ? 'column' : 'column-reverse' }}
            >
              {list.map((t) => {
                const { theme: toastTheme, motion } = themeFor(t);
                const bar =
                  t.type === 'custom' ? (
                    <div style={{ pointerEvents: 'auto' }}>{resolveValue(t.message, t)}</div>
                  ) : children ? (
                    children(t)
                  ) : (
                    <ToastBar
                      toast={t}
                      theme={toastTheme}
                      preset={preset}
                      icons={icons}
                      glass={glass}
                      onDismiss={onDismiss}
                      onPauseStart={startPause}
                      onPauseEnd={endPause}
                      atTop={anchoredTop}
                      paused={t.action?.countdown ? paused : false}
                      panThreshold={panThreshold}
                      pauseOnHover={pauseOnHover}
                    />
                  );
                return (
                  <ToastBarContext.Provider
                    key={t.id}
                    value={{ theme: toastTheme, preset, icons, glass, onDismiss, onPauseStart: startPause, onPauseEnd: endPause, atTop: anchoredTop, panThreshold, pauseOnHover }}
                  >
                    <ToastItem toast={t} atTop={anchoredTop} gap={bucket.startsWith('banner') ? 0 : gap} motion={motion} justify={layout.justify} render={bar} />
                  </ToastBarContext.Provider>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

export { ACCENTS };
