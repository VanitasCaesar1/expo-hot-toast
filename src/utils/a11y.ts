import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { TextStyle } from 'react-native';

/**
 * Accessibility settings are read once per app and cached at module scope.
 *
 * Two problems this solves beyond tidiness. A toast mounted on the very first
 * frame would otherwise render with motion and transparency enabled, then
 * correct itself a tick later — a visible flash for anyone who has asked for
 * reduced motion, and the worst possible first impression. And resolving the
 * same promise per mounted component means every Toaster schedules its own
 * state update after mount.
 *
 * The cache is keyed per predicate so motion and transparency stay independent.
 */
const cache = new Map<string, { value: boolean; resolved: boolean }>();

function readCached(key: string): boolean {
  return cache.get(key)?.value ?? false;
}

function resolveFlag(
  key: string,
  query: () => Promise<boolean>,
): Promise<boolean> {
  const existing = cache.get(key);
  if (existing?.resolved) return Promise.resolve(existing.value);

  // A platform may not implement the query at all: React Native Web has no
  // isReduceTransparencyEnabled, and calling it threw on mount, which took the
  // whole app down. Missing counts as "off".
  let started: Promise<boolean>;
  try {
    started = query();
  } catch {
    started = Promise.resolve(false);
  }
  const pending = started
    .then((value) => {
      cache.set(key, { value, resolved: true });
      return value;
    })
    .catch(() => {
      // Unknown. Keep the permissive default rather than degrading every
      // user's toast without cause.
      cache.set(key, { value: false, resolved: true });
      return false;
    });

  return pending;
}

const MOTION_KEY = 'reduceMotion';
const TRANSPARENCY_KEY = 'reduceTransparency';

const queryReduceMotion = () => AccessibilityInfo.isReduceMotionEnabled();
const queryReduceTransparency = (): Promise<boolean> => {
  // React Native Web has no answer for this, but a browser can say whether the
  // user asked for less transparency, which the frosted glass honours.
  if (Platform.OS === 'web') {
    const media =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-transparency: reduce)')
        : undefined;
    return Promise.resolve(media?.matches ?? false);
  }
  return AccessibilityInfo.isReduceTransparencyEnabled();
};
const SCREEN_READER_KEY = 'screenReader';
const BOLD_TEXT_KEY = 'boldText';
// iOS only; elsewhere the query is absent, which counts as off.
const queryBoldText = () => AccessibilityInfo.isBoldTextEnabled();
const queryScreenReader = () => AccessibilityInfo.isScreenReaderEnabled();

function useAccessibilityFlag(
  key: string,
  query: () => Promise<boolean>,
  event: 'reduceMotionChanged' | 'reduceTransparencyChanged' | 'screenReaderChanged' | 'boldTextChanged',
): boolean {
  // Seeded synchronously from the cache, so an app that has already resolved
  // this setting renders correctly on the very first frame.
  const [enabled, setEnabled] = useState(() => readCached(key));

  useEffect(() => {
    let cancelled = false;

    const apply = (value: boolean): void => {
      if (cancelled) return;
      setEnabled((previous) => (previous === value ? previous : value));
    };

    resolveFlag(key, query).then(apply);

    // A change is written to the cache as well, or a toast or Toaster mounted
    // after the user toggled the setting would read the old answer forever:
    // the cache says it is resolved, and the event has already fired.
    const changed = (value: boolean): void => {
      cache.set(key, { value, resolved: true });
      apply(value);
    };

    // Optional for the same reason: not every platform emits every event.
    let subscription: { remove?: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener(event, changed);
    } catch {
      subscription = undefined;
    }

    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, [key, query, event]);

  return enabled;
}

/**
 * Reduced motion. Maps onto rht's `prefersReducedMotion()`.
 *
 * rht caches the matchMedia result forever and never re-checks, so toggling the
 * OS setting mid-session has no effect. We subscribe to the change event
 * instead, which is both correct and no more code.
 */
export function useReduceMotion(): boolean {
  return useAccessibilityFlag(MOTION_KEY, queryReduceMotion, 'reduceMotionChanged');
}

/**
 * Reduced transparency.
 *
 * Critically, `isLiquidGlassAvailable()` still returns true on iOS 26 when a
 * user has turned Reduce Transparency on. Relying on the availability check
 * alone means rendering a translucent material to someone who has explicitly
 * asked not to see one. This is the separate signal that closes that gap, and
 * it is why the GlassSurface fallback ladder has three rungs rather than two.
 */
export function useReduceTransparency(): boolean {
  return useAccessibilityFlag(
    TRANSPARENCY_KEY,
    queryReduceTransparency,
    'reduceTransparencyChanged',
  );
}

/**
 * True when the user has Bold Text on (iOS). Toast text takes a heavier
 * weight then, as system text does.
 */
export function useBoldText(): boolean {
  return useAccessibilityFlag(BOLD_TEXT_KEY, queryBoldText, 'boldTextChanged');
}

/** One step heavier, for Bold Text: 400 -> 600, 500 -> 700, and so on. */
export function bolder(weight: TextStyle['fontWeight'] | undefined): TextStyle['fontWeight'] {
  const n = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  if (Number.isNaN(n)) return weight;
  return String(Math.min(n + 200, 900)) as TextStyle['fontWeight'];
}

/** Test-only. Clears the resolved accessibility cache. */
export function __resetAccessibilityCache(): void {
  cache.clear();
}

export type GlassMode = 'glass' | 'opaque';

/**
 * Combine a glass setting with the user's Reduce Transparency preference.
 *
 * Pass `GLASS_SUPPORTED` (or your own setting ANDed with it) as `enabled`; this
 * hook adds only the accessibility check, not platform availability.
 */
export function useGlassMode(enabled: boolean): GlassMode {
  const reduceTransparency = useReduceTransparency();
  return enabled && !reduceTransparency ? 'glass' : 'opaque';
}

/**
 * Announce a toast to screen readers.
 *
 * iOS has no live-region concept, so the announcement has to be imperative.
 * A plain announcement interrupts whatever VoiceOver is saying, which only an
 * error (or an `important` toast) should do; the rest are queued behind the
 * current speech. Android's live region does the same (see ToastBar's
 * `accessibilityLiveRegion`).
 */
export function announce(message: string, assertive: boolean): void {
  if (Platform.OS !== 'ios') return;
  // Older React Native, and some test environments, lack the queued form.
  if (assertive || typeof AccessibilityInfo.announceForAccessibilityWithOptions !== 'function') {
    AccessibilityInfo.announceForAccessibility(message);
  } else {
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
  }
}
/**
 * True while VoiceOver or TalkBack is running. A `stacked` Toaster stays
 * expanded then: a collapsed stack hides the content of every toast but the
 * front one, which a screen reader user would never get to.
 */
export function useScreenReaderEnabled(): boolean {
  const enabled = useAccessibilityFlag(SCREEN_READER_KEY, queryScreenReader, 'screenReaderChanged');
  // A browser cannot tell whether a screen reader is running, and React Native
  // Web answers true unconditionally, which kept every stacked Toaster on the
  // web fanned out. There the answer carries no information, so it is ignored.
  return Platform.OS !== 'web' && enabled;
}
