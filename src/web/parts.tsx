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
  const track = React.useRef<HTMLDivElement>(null);
  const fill = React.useRef<HTMLDivElement>(null);
  useProgress(progress, (value) => {
    if (!track.current || !fill.current) return;
    if (isIndeterminate(value)) {
      track.current.setAttribute('data-indeterminate', '');
      fill.current.style.transform = '';
    } else {
      track.current.removeAttribute('data-indeterminate');
      fill.current.style.transform = `scaleX(${value})`;
    }
  });
  return (
    <div ref={track} className={cx('eht-track', className)} style={{ background: trackColor, ...style }} aria-hidden>
      <div ref={fill} className={cx('eht-fill', barClassName)} style={{ background: color, ...barStyle }} />
      {segments && segments > 1
        ? Array.from({ length: segments - 1 }, (_, i) => (
            <span key={i} className="eht-gap" style={{ left: `${((i + 1) / segments) * 100}%` }} />
          ))
        : null}
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
