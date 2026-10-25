import { useEffect, useRef, useState } from 'react';
import '../glassyui/styles/liquid.css';
import './site-glass.css';
import {
  GlassCommand,
  GlassCommandDialog,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
} from '../glassyui/glass-command';

interface Page {
  title: string;
  url: string;
  group: string;
}

interface Hit {
  url: string;
  title: string;
  excerpt: string;
}

interface Pagefind {
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> }[] }>;
}

/**
 * Search, as a Glassy UI command palette. Pagefind indexes the built site;
 * before you type, the palette lists every docs page. ⌘K, or the header's
 * Search button, opens it.
 */
export default function SiteSearch({ base, pages }: { base: string; pages: Page[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const pagefind = useRef<Promise<Pagefind> | null>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('site:search', show);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('site:search', show);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        pagefind.current ??= import(/* @vite-ignore */ `${base}pagefind.js`).then(async (module: Pagefind) => {
          await module.init();
          return module;
        });
        const engine = await pagefind.current;
        const { results } = await engine.search(q);
        const data = await Promise.all(results.slice(0, 8).map((r) => r.data()));
        if (!cancelled) {
          setHits(data.map((d) => ({ url: d.url, title: d.meta.title ?? d.url, excerpt: d.excerpt })));
        }
      } catch {
        // Pagefind exists only in the built site, not in `astro dev`.
        if (!cancelled) setUnavailable(true);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, base]);

  const go = (url: string) => {
    setOpen(false);
    window.location.href = url;
  };

  const groups = [...new Set(pages.map((p) => p.group))];

  return (
    <GlassCommandDialog open={open} onOpenChange={setOpen} title="Search the docs">
      <GlassCommand shouldFilter={!query.trim()} label="Search the docs">
        <GlassCommandInput value={query} onValueChange={setQuery} placeholder="Search the docs…" />
        <GlassCommandList>
          <GlassCommandEmpty>{unavailable ? 'Search runs on the built site.' : 'Nothing found.'}</GlassCommandEmpty>
          {query.trim()
            ? hits.length > 0 && (
                <GlassCommandGroup heading="Results">
                  {hits.map((hit) => (
                    <GlassCommandItem key={hit.url} value={hit.url} onSelect={() => go(hit.url)}>
                      <span className="search-hit">
                        <span className="search-title">{hit.title}</span>
                        <span className="search-excerpt" dangerouslySetInnerHTML={{ __html: hit.excerpt }} />
                      </span>
                    </GlassCommandItem>
                  ))}
                </GlassCommandGroup>
              )
            : groups.map((group) => (
                <GlassCommandGroup key={group} heading={group}>
                  {pages
                    .filter((p) => p.group === group)
                    .map((p) => (
                      <GlassCommandItem key={p.url} value={`${p.title} ${group}`} onSelect={() => go(p.url)}>
                        {p.title}
                      </GlassCommandItem>
                    ))}
                </GlassCommandGroup>
              ))}
        </GlassCommandList>
      </GlassCommand>
    </GlassCommandDialog>
  );
}
