import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassHeader } from '../glassyui/glass-header';
import { GlassButton } from '../glassyui/glass-button';
import { GlassKbd } from '../glassyui/glass-kbd';
import { Glyph } from './icons';
import StarButton from './StarButton';

interface Props {
  home: string;
  mark: string;
  docs: string;
  changelog: string;
  repo: string;
  inDocs: boolean;
  /** Star count at build time. */
  stars?: number;
}

/** The site header: Glassy UI's floating capsule, which condenses as the page scrolls. */
export default function SiteHeader({ home, mark, docs, changelog, repo, inDocs, stars }: Props) {
  return (
    <GlassHeader
      condenseOnScroll
      lens={false}
      className="site-header"
      brand={
        <a href={home} className="site-brand">
          <img src={mark} alt="" width="30" height="30" />
          <span className="site-name">expo-hot-toast</span>
        </a>
      }
      actions={
        <>
          <GlassButton
            variant="soft"
            size="sm"
            lens={false}
            className="site-search"
            aria-label="Search the docs"
            onClick={() => window.dispatchEvent(new Event('site:search'))}
          >
            <Glyph name="search" />
            <span className="button-label">Search</span>
            <GlassKbd>⌘K</GlassKbd>
          </GlassButton>
          <StarButton repo={repo} initial={stars} size="sm" className="site-github" compact />
        </>
      }
    >
      <a href={docs} aria-current={inDocs ? 'page' : undefined}>
        Docs
      </a>
      <a href={changelog}>Changelog</a>
    </GlassHeader>
  );
}
