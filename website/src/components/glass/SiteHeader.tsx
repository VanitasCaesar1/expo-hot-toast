import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassHeader } from '../glassyui/glass-header';
import { GlassButton } from '../glassyui/glass-button';
import { GlassKbd } from '../glassyui/glass-kbd';
import { Glyph } from './icons';

interface Props {
  home: string;
  mark: string;
  docs: string;
  changelog: string;
  repo: string;
  inDocs: boolean;
}

/** The site header: Glassy UI's floating capsule, which condenses as the page scrolls. */
export default function SiteHeader({ home, mark, docs, changelog, repo, inDocs }: Props) {
  return (
    <GlassHeader
      condenseOnScroll
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
            className="site-search"
            aria-label="Search the docs"
            onClick={() => window.dispatchEvent(new Event('site:search'))}
          >
            <Glyph name="search" />
            <span className="button-label">Search</span>
            <GlassKbd>⌘K</GlassKbd>
          </GlassButton>
          <GlassButton asChild variant="soft" size="sm" className="site-github">
            <a href={repo} aria-label="GitHub">
              <Glyph name="github" />
              <span className="button-label">GitHub</span>
            </a>
          </GlassButton>
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
