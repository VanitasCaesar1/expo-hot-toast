/**
 * The two Reanimated APIs the shared core touches, for the DOM build.
 *
 * - `Easing`: each curve carries the CSS timing function it stands for, which
 *   the DOM renderer reads (`cssEasing`), so motion tokens mean the same thing
 *   on the web as on a phone.
 * - `makeMutable`: a value with listeners. Progress writes to it, and the DOM
 *   progress bar subscribes and sets its own style, so a bar updated sixty
 *   times a second re-renders nothing, as on native.
 */

export interface CssCurve {
  (t: number): number;
  css: string;
}

const curve = (css: string, fn: (t: number) => number = (t) => t): CssCurve => Object.assign(fn, { css });

const QUAD = { in: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)', out: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', inOut: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)' };

const quad = curve('quad', (t) => t * t);

function wrap(kind: 'in' | 'out' | 'inOut', base: CssCurve): CssCurve {
  // Only the curves the library uses need a CSS form; anything else falls back
  // to the matching standard ease.
  if (base === quad) return curve(QUAD[kind]);
  return curve(kind === 'in' ? 'ease-in' : kind === 'out' ? 'ease-out' : 'ease-in-out');
}

export const Easing = {
  bezier: (x1: number, y1: number, x2: number, y2: number): CssCurve => curve(`cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`),
  linear: curve('linear'),
  ease: curve('ease'),
  quad,
  in: (base: CssCurve) => wrap('in', base),
  out: (base: CssCurve) => wrap('out', base),
  inOut: (base: CssCurve) => wrap('inOut', base),
};

/** The CSS timing function for a motion token, or `ease` if it has none. */
export function cssEasing(value: unknown): string {
  const css = (value as { css?: unknown } | null)?.css;
  return typeof css === 'string' && css !== 'quad' ? css : 'ease';
}

export interface Mutable<T> {
  value: T;
  subscribe(listener: (value: T) => void): () => void;
}

export function makeMutable<T>(initial: T): Mutable<T> {
  let current = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get value() {
      return current;
    },
    set value(next: T) {
      current = next;
      listeners.forEach((listener) => listener(next));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type SharedValue<T> = Mutable<T>;
export type WithTimingConfig = { duration?: number; easing?: unknown };
