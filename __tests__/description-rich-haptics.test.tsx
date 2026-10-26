import { render, screen, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Toaster } from '../src/components/toaster';
import { toast } from '../src/core/toast';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { defaultTheme, mergeTheme } from '../src/core/defaults';
import { darkTheme } from '../src/theme/tokens';
import { toastCssVars } from '../src/theme/css-vars';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

/** Every backgroundColor in a rendered tree. */
function backgroundColorsIn(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(backgroundColorsIn);
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
  const own = (StyleSheet.flatten(candidate.props?.style as object) as { backgroundColor?: unknown } | undefined)?.backgroundColor;
  return [...(own === undefined ? [] : [own]), ...(candidate.children ?? []).flatMap(backgroundColorsIn)];
}

describe('description', () => {
  it('renders a second line under the message', () => {
    render(<Toaster />);
    act(() => {
      toast.error('Upload failed', { description: 'Check your connection and try again' });
    });

    expect(screen.getByText('Upload failed')).toBeTruthy();
    expect(screen.getByText('Check your connection and try again')).toBeTruthy();
  });

  it('is announced after the message', () => {
    const original = Platform.OS;
    Platform.OS = 'ios';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      render(<Toaster />);
      act(() => {
        toast('Upload failed', { description: 'Check your connection' });
      });
      expect(announce).toHaveBeenCalledWith('Upload failed. Check your connection');
    } finally {
      Platform.OS = original;
      announce.mockRestore();
    }
  });

  it('draws nothing extra when absent', () => {
    render(<Toaster />);
    act(() => {
      toast('Saved');
    });
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.queryAllByText(/./)).toHaveLength(1);
  });
});

describe('richColors', () => {
  it('fills a success toast with the success palette', () => {
    render(<Toaster />);
    act(() => {
      toast.success('Saved', { richColors: true });
    });
    expect(backgroundColorsIn(screen.toJSON())).toContain(defaultTheme.rich.success.background);
  });

  it('fills an error toast with the error palette', () => {
    render(<Toaster />);
    act(() => {
      toast.error('Failed', { richColors: true });
    });
    expect(backgroundColorsIn(screen.toJSON())).toContain(defaultTheme.rich.error.background);
  });

  it('applies to every toast through toastOptions', () => {
    render(<Toaster toastOptions={{ richColors: true }} />);
    act(() => {
      toast.success('Saved');
    });
    expect(backgroundColorsIn(screen.toJSON())).toContain(defaultTheme.rich.success.background);
  });

  it('leaves other types, and toasts without it, on the normal surface', () => {
    render(<Toaster />);
    act(() => {
      toast('Plain', { richColors: true });
      toast.success('Saved');
    });
    const colors = backgroundColorsIn(screen.toJSON());
    expect(colors).not.toContain(defaultTheme.rich.success.background);
    expect(colors).toContain(defaultTheme.fallbackBackground);
  });

  it('merges a partial palette override without dropping the rest', () => {
    const theme = mergeTheme(defaultTheme, { rich: { error: { tint: 'red' } } });
    expect(theme.rich.error.tint).toBe('red');
    expect(theme.rich.error.background).toBe(defaultTheme.rich.error.background);
    expect(theme.rich.success).toEqual(defaultTheme.rich.success);
  });

  it('has its own dark palette', () => {
    expect(darkTheme.rich.success.background).not.toBe(defaultTheme.rich.success.background);
  });

  it('flattens into CSS variables', () => {
    const vars = toastCssVars(defaultTheme);
    expect(vars['--eh-toast-rich-error-background']).toBe(defaultTheme.rich.error.background);
    expect(vars['--eh-toast-rich']).toBeUndefined();
  });
});

describe('haptics switch', () => {
  it('is on by default', () => {
    render(<Toaster />);
    act(() => {
      toast.success('done');
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it('turns off for a whole Toaster', () => {
    render(<Toaster haptics={false} />);
    act(() => {
      toast.success('done');
      toast.error('broke');
    });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('turns off for one toast', () => {
    render(<Toaster />);
    act(() => {
      toast.success('quiet', { haptics: false });
    });
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('lets one toast opt back in when the Toaster has it off', () => {
    render(<Toaster haptics={false} />);
    act(() => {
      toast.error('important', { haptics: true });
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });
});
