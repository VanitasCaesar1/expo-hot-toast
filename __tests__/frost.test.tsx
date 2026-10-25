import { act, render, renderHook, screen } from '@testing-library/react-native';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import * as ReactNative from 'react-native';
import { StyleSheet, Text } from 'react-native';
import { defaultTheme } from '../src/core/defaults';
import { darkTheme } from '../src/theme/tokens';
import { __resetAccessibilityCache, useReduceTransparency } from '../src/utils/a11y';

/**
 * The frosted rung only exists in a browser that can blur a backdrop, and
 * glass-surface.tsx decides that once at module scope. Each case therefore
 * sets the platform and `CSS.supports` first, then loads the module fresh in an
 * isolated registry, as glass-rung.test.tsx does for Liquid Glass.
 */
type GlassSurfaceModule = typeof import('../src/components/glass-surface');

const platform = ReactNative.Platform as { OS: string };
const originalOS = platform.OS;
const globals = globalThis as { CSS?: { supports: (property: string, value: string) => boolean } };

afterEach(() => {
  platform.OS = originalOS;
  delete globals.CSS;
});

function load(os: string, blur: boolean): GlassSurfaceModule {
  platform.OS = os;
  globals.CSS = { supports: (property) => blur && property.endsWith('backdrop-filter') };
  let loaded: GlassSurfaceModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    jest.doMock('react-native', () => ReactNative);
    loaded = require('../src/components/glass-surface') as GlassSurfaceModule;
  });
  if (!loaded) throw new Error('glass-surface did not load');
  return loaded;
}

function surfaceStyle(): Record<string, unknown> {
  const node = screen.getByTestId('surface');
  return StyleSheet.flatten(node.props.style) as Record<string, unknown>;
}

describe('frosted glass on the web', () => {
  it('is supported in a browser that can blur a backdrop', () => {
    expect(load('web', true).FROST_SUPPORTED).toBe(true);
  });

  it('is not supported without backdrop-filter, or off the web', () => {
    expect(load('web', false).FROST_SUPPORTED).toBe(false);
    expect(load('android', true).FROST_SUPPORTED).toBe(false);
  });

  it('blurs the backdrop under the translucent fill', () => {
    const { GlassSurface } = load('web', true);
    render(
      <GlassSurface theme={defaultTheme} testID="surface">
        <Text>Saved</Text>
      </GlassSurface>,
    );

    const style = surfaceStyle();
    expect(style.backdropFilter).toBe(`blur(${defaultTheme.frostBlur}px) saturate(${defaultTheme.frostSaturation}%)`);
    expect(style.backgroundColor).toBe(defaultTheme.background);
    expect(style.boxShadow).toContain(defaultTheme.border);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('follows the theme tokens', () => {
    const { GlassSurface } = load('web', true);
    render(<GlassSurface theme={{ ...darkTheme, frostBlur: 30 }} testID="surface" />);
    const style = surfaceStyle();
    expect(style.backdropFilter).toContain('blur(30px)');
    expect(style.backgroundColor).toBe(darkTheme.background);
    expect(style.boxShadow).toContain(darkTheme.frostHighlight);
  });

  it('lays the glass tint over the fill', () => {
    const { GlassSurface } = load('web', true);
    render(<GlassSurface theme={defaultTheme} glass={{ tintColor: 'rgba(52,199,89,0.22)' }} testID="surface" />);
    expect(surfaceStyle().backgroundImage).toBe('linear-gradient(rgba(52,199,89,0.22), rgba(52,199,89,0.22))');
  });

  it('draws the opaque surface under Reduce Transparency, or with glass off', () => {
    const { GlassSurface } = load('web', true);
    const { rerender } = render(<GlassSurface theme={defaultTheme} reduceTransparency testID="surface" />);
    expect(surfaceStyle().backdropFilter).toBeUndefined();
    expect(surfaceStyle().backgroundColor).toBe(defaultTheme.fallbackBackground);

    rerender(<GlassSurface theme={defaultTheme} glass={false} testID="surface" />);
    expect(surfaceStyle().backdropFilter).toBeUndefined();
    expect(surfaceStyle().backgroundColor).toBe(defaultTheme.fallbackBackground);
  });
});

describe('Reduce Transparency on the web', () => {
  it('reads the browser preference, which React Native Web cannot answer', async () => {
    const win = globalThis as { window?: { matchMedia?: (query: string) => { matches: boolean } } };
    const hadWindow = 'window' in globalThis;
    const original = win.window?.matchMedia;
    platform.OS = 'web';
    __resetAccessibilityCache();
    win.window = win.window ?? ({} as never);
    win.window!.matchMedia = (query) => ({ matches: query === '(prefers-reduced-transparency: reduce)' });
    try {
      const { result } = renderHook(() => useReduceTransparency());
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current).toBe(true);
    } finally {
      if (hadWindow) win.window!.matchMedia = original;
      else delete win.window;
      __resetAccessibilityCache();
    }
  });
});
