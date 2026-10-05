import { render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { ToastIcon, TOAST_ICON_ACCENTS } from '../src/components/icons';
import { defaultTheme } from '../src/core/defaults';

describe('ToastIcon', () => {
  it('renders nothing for blank', () => {
    // `blank` is the type for "this toast is pure text"; an empty box or a
    // zero-size glyph would still show up as dead space in the row.
    const { toJSON } = render(
      <ToastIcon kind="blank" size={22} theme={defaultTheme} />,
    );

    expect(toJSON()).toBeNull();
    expect(getSvgNodes('Svg')).toHaveLength(0);
    expect(getActivityIndicators()).toHaveLength(0);
  });

  it('renders an ActivityIndicator for loading', () => {
    // ActivityIndicator carries no accessibility role under this preset, so
    // it is only reachable as a host type name. Its wrapper View is what makes
    // the spinner occupy the icon slot instead of collapsing.
    const { toJSON } = render(
      <ToastIcon kind="loading" size={22} theme={defaultTheme} />,
    );

    const spinners = getActivityIndicators();
    expect(spinners).toHaveLength(1);
    expect(spinners[0]!.props.size).toBe('small');
    expect(spinners[0]!.props.color).toBe(defaultTheme.color);
    expect(getSvgNodes('Svg')).toHaveLength(0);
    expect(flatten((toJSON() as { props: Record<string, any> }).props.style)).toMatchObject(
      { width: 22, height: 22 },
    );
  });

  it('draws exactly one Path for success', () => {
    render(<ToastIcon kind="success" size={22} theme={defaultTheme} />);

    expect(getSvgNodes('Path')).toHaveLength(1);
    expect(getSvgNodes('Circle')).toHaveLength(0);
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.success);
  });

  it('draws a Circle and a Path for error', () => {
    render(<ToastIcon kind="error" size={22} theme={defaultTheme} />);

    expect(getSvgNodes('Circle')).toHaveLength(1);
    expect(getSvgNodes('Path')).toHaveLength(1);
    expect(getSvg('Circle').props.stroke).toBe(TOAST_ICON_ACCENTS.error);
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.error);
  });

  it('applies size to the Svg width and height', () => {
    render(<ToastIcon kind="success" size={40} theme={defaultTheme} />);

    const svg = getSvg('Svg');
    expect(svg.props.width).toBe(40);
    expect(svg.props.height).toBe(40);
  });

  it('scales the loading spinner wrapper with size', () => {
    render(<ToastIcon kind="loading" size={48} theme={defaultTheme} />);

    const wrapper = getActivityIndicators()[0]!.parent;
    expect(flatten(wrapper?.props.style)).toMatchObject({ width: 48, height: 48 });
  });

  it('ignores theme colours and uses the shared accent table', () => {
    // Accents encode type semantics, so they are deliberately not theme
    // tokens — a product restyling the surface must not be able to make a
    // failure read as a success.
    const loud: typeof defaultTheme = {
      ...defaultTheme,
      color: '#00FF00',
      background: '#000000',
    };

    render(<ToastIcon kind="success" size={22} theme={loud} />);
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.success);

    render(<ToastIcon kind="error" size={22} theme={loud} />);
    expect(getSvg('Path').props.stroke).toBe(TOAST_ICON_ACCENTS.error);
  });

  it('paints success and error in different colours', () => {
    render(<ToastIcon kind="success" size={22} theme={defaultTheme} />);
    const successStroke = getSvg('Path').props.stroke;

    screen.rerender(<ToastIcon kind="error" size={22} theme={defaultTheme} />);
    const errorStrokes = [
      getSvg('Circle').props.stroke,
      getSvg('Path').props.stroke,
    ];

    expect(errorStrokes).not.toContain(successStroke);
    expect(TOAST_ICON_ACCENTS.success).not.toBe(TOAST_ICON_ACCENTS.error);
  });

  it('keys the accent table by every icon kind', () => {
    // An unkeyed entry would resolve to undefined and paint a black glyph.
    for (const kind of ['success', 'error', 'loading', 'blank'] as const) {
      expect(TOAST_ICON_ACCENTS[kind]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keeps a stable accent for repeated renders', () => {
    const { rerender } = render(
      <ToastIcon kind="success" size={22} theme={defaultTheme} />,
    );
    const first = getSvg('Path').props.stroke;

    rerender(<ToastIcon kind="success" size={22} theme={defaultTheme} />);
    expect(getSvg('Path').props.stroke).toBe(first);
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * The jest setup stubs react-native-svg as host elements whose `type` is a
 * plain string, and RNTL's typed `UNSAFE_queryAllByType` only accepts a
 * component. The cast lives here so the assertions above read by element name.
 */
function getSvgNodes(name: 'Svg' | 'Path' | 'Circle'): Array<{ props: Record<string, any> }> {
  return (
    screen as unknown as {
      UNSAFE_queryAllByType: (type: string) => Array<{ props: Record<string, any> }>;
    }
  ).UNSAFE_queryAllByType(name);
}

function getSvg(name: 'Svg' | 'Path' | 'Circle'): { props: Record<string, any> } {
  const nodes = getSvgNodes(name);
  expect(nodes).toHaveLength(1);
  return nodes[0]!;
}

function getActivityIndicators(): Array<{
  props: Record<string, any>;
  parent: { props: Record<string, any> } | null;
}> {
  return (
    screen as unknown as {
      UNSAFE_queryAllByType: (type: string) => Array<{
        props: Record<string, any>;
        parent: { props: Record<string, any> } | null;
      }>;
    }
  ).UNSAFE_queryAllByType('ActivityIndicator');
}

function flatten(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flatten(entry)), {});
}
