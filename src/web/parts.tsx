import * as React from 'react';
import type { Mutable } from './shims/reanimated';

/**
 * The parts a rich toast is built from, for the DOM. Progress is a value with
 * listeners (see `shims/reanimated.ts`); each part subscribes and writes its
 * own style, so a bar updated on every progress event re-renders nothing.
 */

const isIndeterminate = (value: number) => value < 0;

function useProgress(progress: Mutable<number>, write: (value: number) => void): void {
  const writeRef = React.useRef(write);
  writeRef.current = write;
  React.useLayoutEffect(() => {
    writeRef.current(progress.value);
    return progress.subscribe((value) => writeRef.current(value));
  }, [progress]);
}

/**
 * The progress bar: a rounded track under the toast's text. Steps become
 * separate pills that fill in turn. Writes its own style on every progress
 * event, so nothing re-renders.
 */
export function ProgressBar({
  progress,
  color,
  trackColor,
  segments,
  style,
  barStyle,
  className,
  barClassName,
}: {
  progress: Mutable<number>;
  color: string;
  trackColor: string;
  segments?: number;
  style?: React.CSSProperties;
  barStyle?: React.CSSProperties;
  className?: string;
  barClassName?: string;
}) {
  const count = segments && segments > 1 ? segments : 1;
  const root = React.useRef<HTMLDivElement>(null);
  useProgress(progress, (value) => {
    const el = root.current;
    if (!el) return;
    const fills = el.querySelectorAll<HTMLElement>('.eht-fill');
    if (isIndeterminate(value)) {
      el.setAttribute('data-indeterminate', '');
      fills.forEach((f) => (f.style.transform = ''));
      return;
    }
    el.removeAttribute('data-indeterminate');
    // In steps, the one under way pulses: work is happening there, though how
    // far through it is not known.
    const current = count > 1 && value < 1 ? Math.floor(value * count) : -1;
    fills.forEach((f, i) => {
      const part = Math.min(Math.max(value * count - i, 0), 1);
      f.style.transform = `scaleX(${part})`;
      f.parentElement?.toggleAttribute('data-current', i === current);
    });
  });
  return (
    <div ref={root} className={cx('eht-bar', className)} style={style} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="eht-track" style={{ background: trackColor, color }}>
          <div className={cx('eht-fill', barClassName)} style={{ background: color, ...barStyle }} />
        </div>
      ))}
    </div>
  );
}

export function ProgressRing({ progress, size, color, trackColor }: { progress: Mutable<number>; size: number; color: string; trackColor: string }) {
  const svg = React.useRef<SVGSVGElement>(null);
  const arc = React.useRef<SVGCircleElement>(null);
  const stroke = 2.6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  useProgress(progress, (value) => {
    if (!svg.current || !arc.current) return;
    if (isIndeterminate(value)) {
      svg.current.setAttribute('data-indeterminate', '');
      arc.current.style.strokeDashoffset = String(circumference * 0.7);
    } else {
      svg.current.removeAttribute('data-indeterminate');
      arc.current.style.strokeDashoffset = String(circumference * (1 - value));
    }
  });
  return (
    <svg ref={svg} className="eht-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <circle
        ref={arc}
        className="eht-ring-arc"
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference}
      />
    </svg>
  );
}

export function ProgressPercent({ progress, style }: { progress: Mutable<number>; style?: React.CSSProperties }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  useProgress(progress, (value) => {
    if (ref.current) ref.current.textContent = isIndeterminate(value) ? '' : `${Math.round(value * 100)}%`;
  });
  return <span ref={ref} className="eht-percent" style={style} aria-hidden />;
}

/**
 * A ring that drains around a button over the time the toast has left, as
 * Gmail's Undo does. A CSS animation, started part way through for the time
 * already gone, and held while the queue is paused.
 */
export function CountdownRing({ remaining, total, paused, size, color }: { remaining: number; total: number; paused: boolean; size: number; color: string }) {
  const r = (size - 2) / 2;
  const circumference = 2 * Math.PI * r;
  // Fixed at mount: recomputing it on a re-render would restart the animation
  // from a new point. Pausing only flips the play state.
  const [elapsed] = React.useState(() => Math.max(total - remaining, 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={2} fill="none" />
      <circle
        className="eht-countdown-arc"
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        style={
          {
            '--eht-circumference': circumference,
            animation: `eht-countdown ${total}ms linear ${-elapsed}ms forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          } as React.CSSProperties
        }
      />
    </svg>
  );
}

export function Avatar({ avatar, size, style }: { avatar: unknown; size: number; style?: React.CSSProperties }) {
  const src =
    typeof avatar === 'string'
      ? avatar
      : avatar && typeof avatar === 'object' && 'uri' in (avatar as object)
        ? String((avatar as { uri: unknown }).uri)
        : undefined;
  return (
    <span className="eht-avatar" style={{ width: size, height: size, ...style }}>
      {src !== undefined ? <img src={src} alt="" /> : (avatar as React.ReactNode)}
    </span>
  );
}

/** React Native style arrays, flattened into one CSS object, later entries winning. */
export function flatten(style: unknown): React.CSSProperties | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten).filter(Boolean));
  return style as React.CSSProperties;
}

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
