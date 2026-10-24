import { act, cleanup, render, renderHook, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Toaster } from '../src/components/toaster';
import { ToastIcon } from '../src/components/icons';
import type { ToastIconKind } from '../src/components/icons';
import { defaultMotion, defaultTheme, defaultTimeouts } from '../src/core/defaults';
import { __resetIdCounter } from '../src/core/ids';
import { __resetStore } from '../src/core/store';
import { toast } from '../src/core/toast';
import type { Toast } from '../src/core/types';
import { useToaster } from '../src/core/use-toaster';

/**
 * Defects found by running the example on an iOS 26 simulator, each pinned so it
 * cannot come back unnoticed.
 */
const EPSILON = 1;

beforeEach(() => {
  jest.useFakeTimers();
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  __resetStore();
  jest.useRealTimers();
});

function only(toasts: Toast[]): Toast {
  expect(toasts).toHaveLength(1);
  return toasts[0]!;
}

describe('toast.promise outcome timing', () => {
  it('gives the success toast its full duration, not what the loading toast left over', async () => {
    // The outcome replaces the loading toast under the same id. Its timer used to
    // run from when the *loading* toast appeared, so a request that took longer
    // than the success duration retired the success toast on the tick it arrived.
    const WAIT = 2500;
    const { result } = renderHook(() => useToaster());

    let settle!: () => void;
    await act(async () => {
      void toast.promise(new Promise<void>((resolve) => (settle = resolve)), {
        loading: 'saving',
        success: 'saved',
      });
    });

    act(() => {
      jest.advanceTimersByTime(WAIT);
    });

    await act(async () => {
      settle();
    });
    expect(only(result.current.toasts).type).toBe('success');

    const budget = defaultTimeouts.success - defaultMotion.enter;
    act(() => {
      jest.advanceTimersByTime(budget - EPSILON);
    });
    expect(only(result.current.toasts).visible).toBe(true);

    act(() => {
      jest.advanceTimersByTime(EPSILON + EPSILON);
    });
    expect(only(result.current.toasts).dismissReason).toBe('timeout');
  });

  it('fires the outcome haptic, which an id-only seen-set swallowed', async () => {
    render(<Toaster />);

    let settle!: () => void;
    await act(async () => {
      void toast.promise(new Promise<void>((resolve) => (settle = resolve)), {
        loading: 'saving',
        success: 'saved',
      });
    });
    // Loading is silent by design.
    expect(Haptics.impactAsync).not.toHaveBeenCalled();

    await act(async () => {
      settle();
    });
    expect(screen.getByText('saved')).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });
});

describe('position buckets', () => {
  it('counts an unpositioned toast against the Toaster default, not top-center', () => {
    // With visibleToasts 1, one bottom toast and one top toast are two different
    // stacks and must both be visible.
    const { result } = renderHook(() =>
      useToaster({ visibleToasts: 1, defaultPosition: 'bottom-center' }),
    );

    act(() => {
      toast('bottom, by default');
      toast('top, explicitly', { position: 'top-center' });
    });

    expect(result.current.toasts.map((t) => t.message).sort()).toEqual([
      'bottom, by default',
      'top, explicitly',
    ]);
    expect(result.current.pending).toHaveLength(0);
    expect(
      result.current.toasts.find((t) => t.message === 'bottom, by default')!
        .resolvedPosition,
    ).toBe('bottom-center');
  });
});

describe('toast.custom', () => {
  it('renders the element as-is, without the default bar', () => {
    render(<Toaster />);
    act(() => {
      toast.custom(<Text>bespoke</Text>);
    });

    expect(screen.getByText('bespoke')).toBeTruthy();
    // The default bar is an accessibility alert with a glyph and a material.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('passes the toast to a function message', () => {
    render(<Toaster />);
    act(() => {
      toast.custom((t) => <Text>{`custom ${t.type}`}</Text>);
    });

    expect(screen.getByText('custom custom')).toBeTruthy();
  });
});

describe('ToastIcon', () => {
  it('draws nothing for a kind that has no glyph', () => {
    const { toJSON } = render(
      <ToastIcon kind={'custom' as ToastIconKind} size={22} theme={defaultTheme} />,
    );
    expect(toJSON()).toBeNull();
  });
});
