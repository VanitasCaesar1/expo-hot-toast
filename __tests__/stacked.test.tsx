import { render, renderHook, screen, act, fireEvent } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { Toaster, stackShifts, STACK_PEEK } from '../src/components/toaster';
import { toast } from '../src/core/toast';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { __resetAccessibilityCache, useScreenReaderEnabled } from '../src/utils/a11y';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  __resetAccessibilityCache();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('stackShifts', () => {
  it('leaves the front toast where it is', () => {
    expect(stackShifts([56, 56, 56], 14, true)[0]).toBe(0);
  });

  it('tucks each toast behind the one in front, a peek further out', () => {
    // Laid out: 0-56, 70-126, 140-196. Collapsed, the far edges land at
    // 56, 66 and 76, so the second moves up by 60 and the third by 120.
    expect(stackShifts([56, 56, 56], 14, true)).toEqual([0, -60, -120]);
  });

  it('moves the other way for a bottom stack', () => {
    expect(stackShifts([56, 56, 56], 14, false)).toEqual([0, 60, 120]);
  });

  it('accounts for toasts of different heights', () => {
    // A tall front toast (80): the second's far edge was at 80 + 14 + 40 and
    // should be at 80 + peek.
    const [, second] = stackShifts([80, 40], 14, true);
    expect(second).toBe(80 + STACK_PEEK - (80 + 14 + 40));
  });
});

/**
 * 0 when the toast showing `text` is tucked behind the front of a collapsed
 * stack, found through its text. Tucked content is also hidden from screen
 * readers, which is the marker read here: the enter fade's own opacity is
 * still at its first frame in tests, so opacity alone cannot tell them apart.
 */
function contentOpacity(text: string): number | undefined {
  let node = screen.getByText(text, { includeHiddenElements: true }).parent;
  while (node) {
    if (node.props.accessibilityElementsHidden === true) {
      const style = StyleSheet.flatten(node.props.style) as { opacity?: number } | undefined;
      return style?.opacity;
    }
    node = node.parent;
  }
  return undefined;
}

function three() {
  act(() => {
    toast('first');
    toast('second');
    toast('third');
  });
}

describe('<Toaster stacked>', () => {
  it('hides the content of every toast behind the front one', () => {
    render(<Toaster stacked />);
    three();

    // The newest toast is at the front.
    expect(contentOpacity('third')).toBeUndefined();
    expect(contentOpacity('second')).toBe(0);
    expect(contentOpacity('first')).toBe(0);
  });

  it('fans out while pressed, and folds back after the finger lifts', () => {
    jest.useFakeTimers();
    render(<Toaster stacked />);
    three();

    fireEvent(screen.getByText('third'), 'pressIn');
    expect(contentOpacity('second')).toBeUndefined();

    fireEvent(screen.getByText('third'), 'pressOut');
    expect(contentOpacity('second')).toBeUndefined();
    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(contentOpacity('second')).toBe(0);
  });

  it('is not collapsed without the prop', () => {
    render(<Toaster />);
    three();
    expect(contentOpacity('second')).toBeUndefined();
  });

  it('stays expanded with reverseOrder', () => {
    render(<Toaster stacked reverseOrder />);
    three();
    expect(contentOpacity('second')).toBeUndefined();
  });

  it('stays expanded while a screen reader is running', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    render(<Toaster stacked />);
    await act(async () => {
      await Promise.resolve();
    });
    three();
    expect(contentOpacity('second')).toBeUndefined();
  });
});

describe('useScreenReaderEnabled', () => {
  async function read(os: string, reported: boolean): Promise<boolean> {
    const platform = Platform as { OS: string };
    const original = platform.OS;
    platform.OS = os;
    __resetAccessibilityCache();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(reported);
    try {
      const { result } = renderHook(() => useScreenReaderEnabled());
      await act(async () => {
        await Promise.resolve();
      });
      return result.current;
    } finally {
      platform.OS = original;
    }
  }

  it('reports a running screen reader on iOS and Android', async () => {
    expect(await read('ios', true)).toBe(true);
    expect(await read('android', true)).toBe(true);
  });

  it('ignores react-native-web, which reports one unconditionally', async () => {
    expect(await read('web', true)).toBe(false);
  });
});
