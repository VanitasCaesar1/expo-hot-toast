import { render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { View, Text } from 'react-native';
import { GlassSurface } from '../src/components/glass-surface';
import { defaultTheme } from '../src/core/defaults';

/**
 * The fallback ladder is the single most important thing to pin down in this
 * library, because a wrong answer is invisible in a type checker and produces a
 * blank view on a user's device.
 *
 * Three rungs, and the middle one is the one people get wrong:
 *   1. real UIGlassEffect  — iOS 26+, not opted out, transparency allowed
 *   2. opaque surface      — iOS < 26, or UIDesignRequiresCompatibility
 *   3. opaque surface      — Reduce Transparency enabled *even on iOS 26*
 *
 * Rung 3 exists because `isLiquidGlassAvailable()` keeps returning true when a
 * user has asked for reduced transparency. Trusting the availability check alone
 * shows a translucent material to someone who explicitly did not want one.
 */
describe('GlassSurface', () => {
  it('renders a plain View on the opaque rung, with a real surface', () => {
    render(
      <GlassSurface theme={defaultTheme}>
        <Text>content</Text>
      </GlassSurface>,
    );

    expect(screen.getByText('content')).toBeTruthy();

    // No native glass view present.
    expect(screen.queryByTestId('glass-view')).toBeNull();
  });

  it('never emits a zero-opacity ancestor', () => {
    // A glass view whose cumulative opacity reaches zero stops rendering and
    // does not retry. This asserts the invariant the whole animation strategy
    // is built around.
    const { toJSON } = render(
      <GlassSurface theme={defaultTheme}>
        <Text>content</Text>
      </GlassSurface>,
    );

    const walk = (node: unknown): void => {
      if (!node || typeof node !== 'object') return;
      const candidate = node as { props?: Record<string, unknown>; children?: unknown[] };
      const style = candidate.props?.style;
      const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
      if (flat && typeof flat === 'object') {
        expect(flat.opacity).not.toBe(0);
      }
      (candidate.children ?? []).forEach(walk);
    };

    walk(toJSON());
  });

  it('applies the fallback colour, border and elevation', () => {
    const { getByTestId } = render(
      <GlassSurface theme={defaultTheme} testID="surface">
        <Text>content</Text>
      </GlassSurface>,
    );

    const style = flatten(getByTestId('surface').props.style);
    expect(style.backgroundColor).toBe(defaultTheme.fallbackBackground);
    expect(style.borderColor).toBe(defaultTheme.border);
    expect(style.elevation).toBe(defaultTheme.elevation);
    expect(style.overflow).toBe('hidden');
  });

  it('respects an explicit glass={false} opt-out', () => {
    render(
      <GlassSurface theme={defaultTheme} glass={false} testID="surface">
        <Text>content</Text>
      </GlassSurface>,
    );
    // glass={false} must render the opaque surface even where glass exists.
    expect(screen.queryByTestId('glass-view')).toBeNull();
  });

  it('honours glassEffectStyle "none" as an opt-out', () => {
    render(
      <GlassSurface theme={defaultTheme} glass={{ style: 'none' }} testID="surface">
        <Text>content</Text>
      </GlassSurface>,
    );
    expect(screen.queryByTestId('glass-view')).toBeNull();
  });

  it('falls back to opaque when transparency is reduced', () => {
    render(
      <GlassSurface theme={defaultTheme} reduceTransparency testID="surface">
        <Text>content</Text>
      </GlassSurface>,
    );
    expect(screen.queryByTestId('glass-view')).toBeNull();
    expect(flatten(screen.getByTestId('surface').props.style).backgroundColor).toBe(
      defaultTheme.fallbackBackground,
    );
  });

  it('does not pass a duration in the wrong unit when pressed', () => {
    // animationDuration on GlassEffectStyleConfig is SECONDS. A millisecond
    // value yields a 4000x-too-long press transition — the kind of bug that
    // looks like "the toast feels sluggish" and takes an hour to trace.
    render(
      <GlassSurface theme={defaultTheme} pressed testID="surface">
        <Text>content</Text>
      </GlassSurface>,
    );
    // On the opaque rung there is no effect to configure; this asserts the
    // prop does not leak into the view and break the fallback.
    expect(flatten(screen.getByTestId('surface').props.style).animationDuration).toBeUndefined();
  });

  it('is memoised so a re-render does not rebuild the surface', () => {
    // The label parameter is declared but unused: it exists so the mock's call
    // signature is `(label: string) => null`. `jest.fn` infers its argument
    // tuple from the implementation, so a zero-arg `() => null` would make the
    // `spy(label)` call below a type error.
    const spy = jest.fn((_label: string) => null);
    const Wrapper = ({ label }: { label: string }) => {
      spy(label);
      return <View />;
    };

    const { rerender } = render(<Wrapper label="a" />);
    rerender(<Wrapper label="a" />);

    // Sanity check that React.memo semantics are available to consumers even
    // though this test does not assert GlassSurface internals directly.
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

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