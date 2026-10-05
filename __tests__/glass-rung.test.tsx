import { render, screen, act } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import * as React from 'react';
import * as ReactNative from 'react-native';
import { Text } from 'react-native';
import { defaultTheme } from '../src/core/defaults';
import type { ToastTheme } from '../src/core/types';

/**
 * The glass rung is the one path in this library that no other suite can reach.
 *
 * `glass-surface.tsx` evaluates `GLASS_SUPPORTED` once at module scope from the
 * two `expo-glass-effect` predicates, so an in-process test can only see a
 * different answer if the module is loaded *after* the predicates are set.
 * `withGlass` below does exactly that: it swaps the mock, builds an isolated
 * module registry, and requires the components fresh inside it.
 *
 * `react` and `react-native` are pinned to the outer registry on purpose.
 * An isolated registry re-executes every module it loads, and a second copy of
 * React means a second hooks dispatcher — the freshly required components would
 * throw "invalid hook call" the moment they mounted.
 */
type GlassSurfaceModule = typeof import('../src/components/glass-surface');
type ToasterModule = typeof import('../src/components/toaster');
type ToastModule = typeof import('../src/core/toast');

interface GlassWorld {
  GlassSurface: GlassSurfaceModule['GlassSurface'];
  GLASS_SUPPORTED: boolean;
  Toaster: ToasterModule['Toaster'];
  toast: ToastModule['toast'];
}

/** The two independent gates, defaulting to "glass is fully available". */
interface Availability {
  liquidGlass?: boolean;
  glassEffectAPI?: boolean;
}

function withGlass<T>(availability: Availability, run: (world: GlassWorld) => T): T {
  let outcome: { value: T } | undefined;

  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    jest.doMock('react-native', () => ReactNative);
    jest.doMock('expo-glass-effect', () => {
      const host = (testID: string, displayName: string) => {
        const Component = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          // `ref` is forwarded so the mock behaves like the real component, but
          // ViewProps does not declare it — hence the cast.
          const hostProps = {
            ...props,
            ref,
            testID: (props.testID as string | undefined) ?? testID,
          } as unknown as React.ComponentProps<typeof ReactNative.View>;

          return React.createElement(
            ReactNative.View,
            hostProps,
            props.children as React.ReactNode,
          );
        });
        Component.displayName = displayName;
        return Component;
      };

      return {
        __esModule: true,
        GlassView: host('glass-view', 'GlassView'),
        GlassContainer: host('glass-container', 'GlassContainer'),
        isLiquidGlassAvailable: jest.fn(() => availability.liquidGlass ?? true),
        isGlassEffectAPIAvailable: jest.fn(() => availability.glassEffectAPI ?? true),
      };
    });

    const glassSurface = require('../src/components/glass-surface') as GlassSurfaceModule;
    const toaster = require('../src/components/toaster') as ToasterModule;
    const toastModule = require('../src/core/toast') as ToastModule;

    outcome = {
      value: run({
        GlassSurface: glassSurface.GlassSurface,
        GLASS_SUPPORTED: glassSurface.GLASS_SUPPORTED,
        Toaster: toaster.Toaster,
        toast: toastModule.toast,
      }),
    };
  });

  if (!outcome) throw new Error('the isolated registry produced no result');
  return outcome.value;
}

describe('GlassSurface — the glass rung', () => {
  it('renders a real GlassView when both predicates report available', () => {
    withGlass({}, ({ GlassSurface, GLASS_SUPPORTED }) => {
      expect(GLASS_SUPPORTED).toBe(true);

      render(
        <GlassSurface theme={defaultTheme}>
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    expect(screen.getByText('content')).toBeTruthy();
    // No testID was passed, so the mocked GlassView falls back to its own.
    expect(screen.queryByTestId('glass-view')).not.toBeNull();
    // A plain View cannot be handed an effect config, so this is the positive
    // signal that the glass component itself rendered rather than a fallback.
    expect(screen.getByTestId('glass-view').props.glassEffectStyle).toBe('regular');
  });

  it('forwards the configured tintColor and glassEffectStyle to the glass view', () => {
    withGlass({}, ({ GlassSurface }) => {
      render(
        <GlassSurface theme={defaultTheme} glass={{ tintColor: '#ff0066', style: 'clear' }}>
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    const view = screen.getByTestId('glass-view');
    expect(view.props.tintColor).toBe('#ff0066');
    expect(view.props.glassEffectStyle).toBe('clear');
  });

  it('paints no theme background behind real glass', () => {
    // Real glass supplies its own material. A background behind it would defeat
    // it — the refraction samples whatever is underneath.
    const SENTINEL = 'rgb(9, 9, 9)';
    const theme: ToastTheme = { ...defaultTheme, fallbackBackground: SENTINEL };

    withGlass({}, ({ GlassSurface }) => {
      render(
        <GlassSurface theme={theme}>
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    const view = screen.getByTestId('glass-view');
    expect(flatten(view.props.style).backgroundColor).toBeUndefined();
    // Walked rather than spot-checked: a background could arrive on an
    // ancestor instead, which is exactly as invisible.
    expect(backgroundColorsIn(screen.toJSON())).not.toContain(SENTINEL);
  });
});

describe('GlassSurface — the opaque rungs', () => {
  it('falls back to opaque when the glass effect API is unavailable', () => {
    // iOS 26 betas threw inside the UIGlassEffect initializer
    // (expo/expo#40911), which is why "the API exists" is a separate gate from
    // "liquid glass exists". Mounting on such a build crashes rather than
    // degrades, so the safe answer is opaque.
    withGlass({ liquidGlass: true, glassEffectAPI: false }, ({ GlassSurface, GLASS_SUPPORTED }) => {
      expect(GLASS_SUPPORTED).toBe(false);

      render(
        <GlassSurface theme={defaultTheme} testID="surface">
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    expect(screen.queryByTestId('glass-view')).toBeNull();
    expect(flatten(screen.getByTestId('surface').props.style).backgroundColor).toBe(
      defaultTheme.fallbackBackground,
    );
  });

  it('falls back to opaque when liquid glass is unavailable', () => {
    withGlass({ liquidGlass: false, glassEffectAPI: true }, ({ GlassSurface, GLASS_SUPPORTED }) => {
      expect(GLASS_SUPPORTED).toBe(false);

      render(
        <GlassSurface theme={defaultTheme} testID="surface">
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    expect(screen.queryByTestId('glass-view')).toBeNull();
    expect(flatten(screen.getByTestId('surface').props.style).backgroundColor).toBe(
      defaultTheme.fallbackBackground,
    );
  });

  it('falls back to opaque when transparency is reduced, even with glass available', () => {
    // The subtle rung. `isLiquidGlassAvailable()` still returns true when the
    // user has asked for reduced transparency, so availability alone would show
    // a translucent material to someone who explicitly did not want one.
    withGlass({}, ({ GlassSurface, GLASS_SUPPORTED }) => {
      expect(GLASS_SUPPORTED).toBe(true);

      render(
        <GlassSurface theme={defaultTheme} reduceTransparency testID="surface">
          <Text>content</Text>
        </GlassSurface>,
      );
    });

    expect(screen.queryByTestId('glass-view')).toBeNull();
    expect(flatten(screen.getByTestId('surface').props.style).backgroundColor).toBe(
      defaultTheme.fallbackBackground,
    );
  });
});

describe('Toaster — the glass stack', () => {
  it('wraps each toast in a GlassContainer that contains its GlassView', () => {
    const GUTTER = 12;

    withGlass({}, ({ Toaster, toast }) => {
      render(<Toaster gutter={GUTTER} />);
      act(() => {
        toast('first');
        toast('second');
      });
    });

    const containers = screen.getAllByTestId('glass-container');
    // One container per toast. Without it UIKit draws N separate floating
    // chips; with it the stack reads as a single continuous material.
    expect(containers).toHaveLength(2);
    expect(screen.getAllByTestId('glass-view')).toHaveLength(2);

    containers.forEach((container) => {
      const nested = container.findAll((node) => node.props?.testID === 'glass-view', {
        deep: true,
      });
      expect(nested).toHaveLength(1);
    });

    // The merge is driven by the stack gap, so the container knows how much
    // material to leave between neighbours.
    expect(containers[0]!.props.spacing).toBe(GUTTER);
  });

  it('drops the GlassContainer when containerize is false, keeping the GlassView', () => {
    withGlass({}, ({ Toaster, toast }) => {
      render(<Toaster glass={{ containerize: false }} />);
      act(() => {
        toast('unmerged');
      });
    });

    expect(screen.queryByTestId('glass-container')).toBeNull();
    expect(screen.getByText('unmerged')).toBeTruthy();
    expect(screen.getAllByTestId('glass-view')).toHaveLength(1);
  });

  it('falls back to opaque for one toast that opts out while its sibling stays on glass', () => {
    // A sentinel colour, so the assertion does not depend on the light/dark
    // theme the Toaster resolves from useColorScheme.
    const SENTINEL = 'rgb(4, 5, 6)';

    withGlass({}, ({ Toaster, toast }) => {
      render(<Toaster theme={{ fallbackBackground: SENTINEL }} />);
      act(() => {
        toast('opaque sibling', { glass: false });
        toast('glass sibling');
      });
    });

    expect(screen.getByText('opaque sibling')).toBeTruthy();
    expect(screen.getByText('glass sibling')).toBeTruthy();

    // The opting-out toast leaves the container with the rest of the stack.
    expect(screen.getAllByTestId('glass-container')).toHaveLength(1);
    expect(screen.getAllByTestId('glass-view')).toHaveLength(1);

    const painted = backgroundColorsIn(screen.toJSON()).filter(
      (colour) => colour === SENTINEL,
    );
    expect(painted).toHaveLength(1);
    expect(flatten(screen.getByTestId('glass-view').props.style).backgroundColor).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Local flatten. `StyleSheet.flatten` is absent from the jest-expo React Native
 * mock, and depending on it here would make these assertions fail for a reason
 * that has nothing to do with the code under test.
 */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.filter(Boolean).reduce<Record<string, unknown>>(
      (acc, entry) => Object.assign(acc, flatten(entry)),
      {},
    );
  }
  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }
  return {};
}

/** Every backgroundColor anywhere in the rendered tree, own node first. */
function backgroundColorsIn(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return [];
  const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };

  const own = flatten(candidate.props?.style).backgroundColor;
  return [
    ...(own === undefined ? [] : [own]),
    ...(candidate.children ?? []).flatMap(backgroundColorsIn),
  ];
}

/**
 * The Reduce Transparency rung reached through the public API.
 *
 * Regression test for the most serious bug found during the port: Toaster
 * computed `reduceTransparency` and handed it to ToastSlot, which destructured
 * it and then dropped it — ToastBar had no such prop. Glass was therefore
 * rendered to users who had explicitly asked for no transparency, through the
 * only API anyone actually uses. Rung 3 was unreachable in production.
 */
describe('Toaster — reduce transparency reaches the surface', () => {
  it('falls back to opaque for every toast when transparency is reduced', async () => {
    const { AccessibilityInfo } = require('react-native');
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled')
      .mockResolvedValue(true);
    const { __resetAccessibilityCache } = require('../src/utils/a11y');
    __resetAccessibilityCache();

    try {
      let supported: boolean | undefined;

      withGlass({}, ({ Toaster, toast, GLASS_SUPPORTED }) => {
        supported = GLASS_SUPPORTED;
        render(<Toaster />);
        act(() => {
          toast('transparency off');
        });
      });

      // Without this the assertion below would be vacuous: no glass view could
      // appear simply because the capability was never available.
      expect(supported).toBe(true);

      await act(async () => {});

      expect(screen.queryByTestId('glass-view')).toBeNull();
      expect(screen.getByText('transparency off')).toBeTruthy();
    } finally {
      spy.mockRestore();
      const { __resetAccessibilityCache } = require('../src/utils/a11y');
      __resetAccessibilityCache();
    }
  });
});
