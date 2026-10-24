import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

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
const queryReduceTransparency = () =>
  AccessibilityInfo.isReduceTransparencyEnabled();
const SCREEN_READER_KEY = 'screenReader';
const queryScreenReader = () => AccessibilityInfo.isScreenReaderEnabled();

function useAccessibilityFlag(
  key: string,
  query: () => Promise<boolean>,
  event: 'reduceMotionChanged' | 'reduceTransparencyChanged' | 'screenReaderChanged',
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

    // Optional for the same reason: not every platform emits every event.
    let subscription: { remove?: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener(event, apply);
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
 * iOS has no live-region concept, so the announcement has to be imperative. The
 * `assertive` flag is currently ignored: iOS offers no way to interrupt
 * whatever VoiceOver is already saying, so an error cannot preempt a polite
 * message in progress. The argument is kept so Android's real live region can
 * honour it (see ToastBar's `accessibilityLiveRegion`) and so a future API with
 * interruption support has somewhere to plug in.
 */
export function announce(message: string, assertive: boolean): void {
  void assertive;
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(message);
  }
}
/**
 * True while VoiceOver or TalkBack is running. A `stacked` Toaster stays
 * expanded then: a collapsed stack hides the content of every toast but the
 * front one, which a screen reader user would never get to.
 */
export function useScreenReaderEnabled(): boolean {
  return useAccessibilityFlag(SCREEN_READER_KEY, queryScreenReader, 'screenReaderChanged');
}
