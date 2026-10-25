import * as React from 'react';

/**
 * The built-in glyphs, drawn with the same paths, colours and timing as the
 * native ones. The strokes draw in with CSS (classes in `styles.ts`), and
 * Reduce Motion shows them finished.
 */

export type WebIconKind = 'success' | 'error' | 'loading' | 'info' | 'warning' | 'blank';

export const ACCENTS: Record<WebIconKind, string> = {
  success: '#34C759',
  error: '#FF3B30',
  info: '#0A84FF',
  warning: '#FF9F0A',
  loading: '#8E8E93',
  blank: '#8E8E93',
};

const CHECK_PATH = 'M4 12l5 5L20 6';
const CHECK_LENGTH = Math.hypot(5, 5) + Math.hypot(11, 11);

export function ToastGlyph({ kind, size, color }: { kind: WebIconKind; size: number; color?: string }) {
  const accent = color ?? ACCENTS[kind];
  const svg = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;

  if (kind === 'blank') return null;
  if (kind === 'loading') {
    return (
      <svg {...svg} className="eht-spinner">
        <circle cx="12" cy="12" r="9" stroke={accent} strokeOpacity={0.25} strokeWidth={2.4} />
        <path d="M21 12a9 9 0 0 0-9-9" stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'success') {
    return (
      <svg {...svg}>
        <path
          className="eht-draw eht-check"
          d={CHECK_PATH}
          stroke={accent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          // The gap is wider than the path, so a round cap cannot paint a dot
          // at the far end while the check is still undrawn.
          strokeDasharray={`${CHECK_LENGTH} ${CHECK_LENGTH * 2}`}
          style={{ '--eht-length': CHECK_LENGTH } as React.CSSProperties}
        />
      </svg>
    );
  }
  if (kind === 'warning') {
    return (
      <svg {...svg}>
        <path
          d="M10.3 4.3a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3Z"
          stroke={accent}
          strokeWidth={2.1}
          strokeLinejoin="round"
        />
        <path className="eht-mark" d="M12 9.4v4.4M12 16.9h.01" stroke={accent} strokeWidth={2.4} strokeLinecap="round" />
      </svg>
    );
  }
  // Error and info: a ring with a mark that pops in after it.
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9.2" stroke={accent} strokeWidth={2.2} />
      <path
        className="eht-mark"
        d={kind === 'info' ? 'M12 11.2v5.2M12 7.9h.01' : 'M12 7.6v5.2M12 16.1h.01'}
        stroke={accent}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CloseGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6L18 18M18 6L6 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

export function ChevronGlyph({ open, color, size = 16 }: { open: boolean; color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="eht-chevron"
      style={{ transform: open ? 'rotate(180deg)' : undefined }}
    >
      <path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
