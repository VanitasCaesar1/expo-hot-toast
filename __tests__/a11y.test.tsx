import { act, renderHook } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  __resetAccessibilityCache,
  announce,
  useGlassMode,
  useReduceMotion,
  useReduceTransparency,
} from '../src/utils/a11y';

/** The shape both hooks register for their change event. */
type ChangeHandler = (value: boolean) => void;

/**
 * React Native's Jest mock ships AccessibilityInfo as bare jest.fn()s, so
 * `jest.spyOn` recognises the property as already-mocked and hands the same
 * mock straight back instead of wrapping it. Nothing is registered for
 * restoration either, which means an implementation set by one test survives
 * into the next unless every test declares its own. The baseline below is what
 * makes each test independent.
 */
beforeEach(() => {
  __resetAccessibilityCache();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest
    .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
    .mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useReduceMotion', () => {
  it('is false on the first frame, before the platform has answered', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotion());

    // Asserted with no await in between: the first frame can only ever carry the
    // module-scope cache, which is empty here. Reading this after a flush would
    // be asserting nothing.
    expect(result.current).toBe(false);

    // Flushed only so the pending resolution lands inside act() and the test
    // leaves nothing pending behind.
    await flushPromises();
    expect(result.current).toBe(true);
  });

  it('becomes true once the platform reports reduced motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotion());
    expect(result.current).toBe(false);

    await flushPromises();
    expect(result.current).toBe(true);
  });

  it('follows the reduceMotionChanged event in both directions', async () => {
    const handlers = captureChangeHandlers();
    const { result } = renderHook(() => useReduceMotion());
    await flushPromises();
    expect(result.current).toBe(false);

    // react-hot-toast caches its matchMedia read forever and never re-checks,
    // so toggling the OS setting mid-session does nothing there. Subscribing is
    // the whole point of this hook.
    act(() => {
      handler(handlers, 'reduceMotionChanged')(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      handler(handlers, 'reduceMotionChanged')(false);
    });
    expect(result.current).toBe(false);
  });

  it('stops following the event after unmount', async () => {
    const handlers = captureChangeHandlers();
    const { unmount } = renderHook(() => useReduceMotion());
    await flushPromises();

    unmount();

    // The subscription sets a `cancelled` flag rather than only unsubscribing,
    // so a late event cannot resurrect state on a dead component.
    expect(() => handler(handlers, 'reduceMotionChanged')(true)).not.toThrow();
  });

  it('seeds a later instance from the cache, synchronously', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const first = renderHook(() => useReduceMotion());
    expect(first.result.current).toBe(false);
    await flushPromises();
    expect(first.result.current).toBe(true);
    first.unmount();

    const second = renderHook(() => useReduceMotion());

    // Correct on the very first frame, with no paint of an un-reduced-motion
    // toast in between. That flash is the entire reason the cache is at module
    // scope rather than per hook.
    expect(second.result.current).toBe(true);

    await flushPromises();
    expect(second.result.current).toBe(true);
  });

  it('does not query the platform again once the cache is resolved', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const first = renderHook(() => useReduceMotion());
    await flushPromises();
    first.unmount();

    renderHook(() => useReduceMotion());
    await flushPromises();

    // One native round trip per app session, not one per mounted component.
    expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalledTimes(1);
  });

  it('falls back to false when the platform query rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockRejectedValue(new Error('native module unavailable'));

    const { result } = renderHook(() => useReduceMotion());

    // Unknown is not the same as off, but the permissive default is right here:
    // degrading every user's toast because a probe failed is worse than showing
    // one animation too many.
    await expect(flushPromises()).resolves.toBeUndefined();
    expect(result.current).toBe(false);
  });
});

describe('useReduceTransparency', () => {
  it('is false on the first frame, before the platform has answered', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);

    const { result } = renderHook(() => useReduceTransparency());

    expect(result.current).toBe(false);

    // Flushed only so the pending resolution lands inside act() and the test
    // leaves nothing pending behind.
    await flushPromises();
    expect(result.current).toBe(true);
  });

  it('becomes true once the platform reports reduced transparency', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);

    const { result } = renderHook(() => useReduceTransparency());
    expect(result.current).toBe(false);

    await flushPromises();
    expect(result.current).toBe(true);
  });

  it('follows the reduceTransparencyChanged event in both directions', async () => {
    const handlers = captureChangeHandlers();
    const { result } = renderHook(() => useReduceTransparency());
    await flushPromises();
    expect(result.current).toBe(false);

    act(() => {
      handler(handlers, 'reduceTransparencyChanged')(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      handler(handlers, 'reduceTransparencyChanged')(false);
    });
    expect(result.current).toBe(false);
  });

  it('seeds a later instance from the cache, synchronously', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);

    const first = renderHook(() => useReduceTransparency());
    expect(first.result.current).toBe(false);
    await flushPromises();
    first.unmount();

    const second = renderHook(() => useReduceTransparency());
    expect(second.result.current).toBe(true);

    await flushPromises();
    expect(second.result.current).toBe(true);
  });

  it('caches motion and transparency independently', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(false);

    const motion = renderHook(() => useReduceMotion());
    const transparency = renderHook(() => useReduceTransparency());
    await flushPromises();

    expect(motion.result.current).toBe(true);
    expect(transparency.result.current).toBe(false);
  });

  it('falls back to false when the platform query rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockRejectedValue(new Error('native module unavailable'));

    const { result } = renderHook(() => useReduceTransparency());

    await expect(flushPromises()).resolves.toBeUndefined();
    expect(result.current).toBe(false);
  });
});

describe('useGlassMode', () => {
  it('returns glass when glass is on and transparency is allowed', async () => {
    const { result } = renderHook(() => useGlassMode(true));

    await flushPromises();
    expect(result.current).toBe('glass');
  });

  it('falls back to opaque when the user has asked for reduced transparency', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);

    const { result } = renderHook(() => useGlassMode(true));

    await flushPromises();
    // isLiquidGlassAvailable() still reports true here on iOS 26, so this rung
    // only exists because reduce transparency is checked separately.
    expect(result.current).toBe('opaque');
  });

  it('returns opaque when glass is off, with transparency allowed', async () => {
    const { result } = renderHook(() => useGlassMode(false));

    await flushPromises();
    expect(result.current).toBe('opaque');
  });

  it('returns opaque when glass is off and transparency is reduced', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);

    const { result } = renderHook(() => useGlassMode(false));

    await flushPromises();
    expect(result.current).toBe('opaque');
  });

  it('flips from opaque to glass the moment the change event says so', async () => {
    const handlers = captureChangeHandlers();
    const { result } = renderHook(() => useGlassMode(true));
    await flushPromises();

    expect(result.current).toBe('glass');

    act(() => {
      handler(handlers, 'reduceTransparencyChanged')(true);
    });
    expect(result.current).toBe('opaque');
  });
});

describe('announce', () => {
  it('speaks through announceForAccessibility on iOS', () => {
    // The jest-expo preset resolves the ios platform, so iOS is the branch that
    // actually runs here; Android is covered by replacing Platform.OS below.
    expect(Platform.OS).toBe('ios');

    const announceForAccessibility = jest.spyOn(
      AccessibilityInfo,
      'announceForAccessibility',
    );

    expect(() => announce('saved to your profile', false)).not.toThrow();
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(announceForAccessibility).toHaveBeenCalledWith('saved to your profile');
  });

  it('does not throw for an assertive announcement either', () => {
    const announceForAccessibility = jest.spyOn(
      AccessibilityInfo,
      'announceForAccessibility',
    );

    expect(() => announce('could not reach the server', true)).not.toThrow();
    expect(announceForAccessibility).toHaveBeenCalledTimes(1);
    expect(announceForAccessibility).toHaveBeenCalledWith(
      'could not reach the server',
    );
  });

  it('is a silent no-op on Android, which has a real live region', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const announceForAccessibility = jest.spyOn(
      AccessibilityInfo,
      'announceForAccessibility',
    );

    // Android's ToastBar sets accessibilityLiveRegion on the view instead, so
    // an imperative announcement here would double-speak.
    expect(() => announce('saved to your profile', false)).not.toThrow();
    expect(announceForAccessibility).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Drain the microtask queue inside act(). The hooks push their state update
 * from the `.then` of a native promise, so nothing lands until the current
 * synchronous run of the test ends.
 */
async function flushPromises(): Promise<void> {
  await act(async () => {
    // Intentionally empty — awaiting act is the flush.
  });
}

/**
 * Replace `AccessibilityInfo.addEventListener` so a test can drive the OS
 * change event by hand, and hand back the captured callbacks keyed by event
 * name. The real signature is generic over React Native's event map; widening
 * it to `(event: string, handler: (value: boolean) => void)` is exactly what
 * both hooks register.
 */
function captureChangeHandlers(): Map<string, ChangeHandler> {
  const captured = new Map<string, ChangeHandler>();

  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
    event: string,
    onChange: ChangeHandler,
  ) => {
    captured.set(event, onChange);
    return { remove: () => undefined };
  }) as never);

  return captured;
}

function handler(handlers: Map<string, ChangeHandler>, event: string): ChangeHandler {
  const captured = handlers.get(event);
  if (!captured) {
    throw new Error(`no listener registered for "${event}"`);
  }
  return captured;
}
