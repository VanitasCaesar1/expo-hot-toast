/**
 * Minimal Easing stand-in. The bezier curves are real math; the suite asserts on
 * durations and ordering rather than on pixel-perfect easing output, so an
 * identity function per curve is sufficient — but each factory stays distinct
 * so a test can prove two different curves are in play.
 */
const makeCurve = (name: string) => {
  const fn = (t: number) => t;
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
};

export const Easing = {
  bezier: (_x1: number, _y1: number, _x2: number, _y2: number) =>
    makeCurve('bezier'),
  linear: makeCurve('linear'),
  ease: makeCurve('ease'),
  inOut: makeCurve('inOut'),
};

export const withTiming = (
  toValue: unknown,
  _config?: unknown,
) => toValue;

export const FadeIn = { duration: () => FadeIn };
export const FadeOut = { duration: () => FadeOut };
export const LinearTransition = {
  duration: () => LinearTransition,
  easing: () => LinearTransition,
};

export default { Easing, withTiming, FadeIn, FadeOut, LinearTransition };