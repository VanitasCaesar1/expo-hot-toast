/**
 * The docs are the repository's README (and docs/design.md), split into pages
 * at build time. Nothing is copied by hand, so the site and GitHub cannot
 * disagree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { unified } from '@astrojs/markdown-remark';
import { relativeLinksToGitHub } from './remark-github-links.mjs';

const ROOT = path.resolve(process.cwd(), '..');

export interface DocPage {
  slug: string;
  title: string;
  group: 'Getting started' | 'Guides' | 'More';
  markdown: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Split markdown on headings of one level, ignoring `#` lines inside fences. */
function split(markdown: string, level: number): { title: string; body: string }[] {
  const marker = `${'#'.repeat(level)} `;
  const out: { title: string; body: string }[] = [{ title: '', body: '' }];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (/^(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && line.startsWith(marker)) {
      out.push({ title: line.slice(marker.length).trim(), body: '' });
      continue;
    }
    out[out.length - 1]!.body += `${line}\n`;
  }
  return out;
}

/** Drop one heading level, so a page's ### sections read as its ##. */
const promote = (md: string) => {
  let fenced = false;
  return md
    .split('\n')
    .map((line) => {
      if (/^(```|~~~)/.test(line)) fenced = !fenced;
      return !fenced && /^#{3,6} /.test(line) ? line.slice(1) : line;
    })
    .join('\n');
};

const RENAME: Record<string, string> = {
  Install: 'Installation',
  Features: 'Introduction',
};

export function loadDocs(): DocPage[] {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const [preamble, ...sections] = split(readme, 2);
  const pages: DocPage[] = [];

  for (const { title, body } of sections) {
    if (title === 'Contributing' || title === 'License') continue;
    if (title === 'Usage') {
      // Each usage topic is its own guide.
      const [, ...guides] = split(body, 3);
      for (const g of guides) {
        pages.push({ slug: slugify(g.title), title: g.title, group: 'Guides', markdown: g.body.trim() });
      }
      continue;
    }
    const name = RENAME[title] ?? title;
    let markdown = promote(body).trim();
    if (title === 'Features') {
      // The README's opening (minus its title, badges and screenshots) introduces the library.
      const intro = preamble!.body
        .split('\n')
        .filter((l) => !/^# |^\[!\[|^<!--/.test(l))
        .join('\n')
        .trim();
      markdown = `${intro}\n\n## Features\n\n${markdown}`;
    }
    const group = ['Features', 'Install', 'Platform support'].includes(title) ? 'Getting started' : 'More';
    pages.push({ slug: slugify(name), title: name, group, markdown });
  }

  const design = fs.readFileSync(path.join(ROOT, 'docs/design.md'), 'utf8');
  pages.push({
    slug: 'design-notes',
    title: 'Design notes',
    group: 'More',
    markdown: promote(design.replace(/^# .*\n/, '')).trim(),
  });

  const order = { 'Getting started': 0, Guides: 1, More: 2 } as const;
  return pages.sort((a, b) => order[a.group] - order[b.group]);
}

/** README anchors that became pages: `#the-toaster` -> `the-toaster`. */
function crossLinks(slugs: Set<string>, base: string) {
  return () => (tree: any) => {
    const walk = (node: any) => {
      if (node.type === 'link' && typeof node.url === 'string' && node.url.startsWith('#')) {
        const target = node.url.slice(1);
        if (slugs.has(target)) node.url = `${base}${target}`;
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

export async function renderDocs(pages: DocPage[], base: string) {
  const renderer = await unified({
    remarkPlugins: [relativeLinksToGitHub, crossLinks(new Set(pages.map((p) => p.slug)), base)],
  }).createRenderer({ shikiConfig: { theme: 'github-dark-dimmed' } });
  return Promise.all(
    pages.map(async (p) => {
      const { code, metadata } = await renderer.render(p.markdown);
      return { ...p, html: code, headings: metadata.headings.filter((h) => h.depth === 2) };
    }),
  );
}
