import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowUpRight from '@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw';
import search from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?raw';
import star from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import { siGithub } from 'simple-icons';

/** The site's glyphs for React islands, as Icon.astro has them for pages. */
const glyphs = {
  copy,
  check,
  search,
  star,
  'arrow-right': arrowRight,
  'arrow-up-right': arrowUpRight,
  github: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${siGithub.path}"/></svg>`,
} as const;

export type GlyphName = keyof typeof glyphs;

export function Glyph({ name }: { name: GlyphName }) {
  return (
    <span
      className="glyph"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: glyphs[name].replace('<svg', '<svg focusable="false"') }}
    />
  );
}
