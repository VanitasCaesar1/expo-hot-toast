/**
 * The docs are the Markdown files in docs/guide, one page each, read at build
 * time. They render on GitHub as well, so links between them are relative
 * `./page.md` links; the site rewrites those to its own pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { unified } from '@astrojs/markdown-remark';
import { relativeLinksToGitHub } from './remark-github-links.mjs';

const ROOT = path.resolve(process.cwd(), '..');
const GUIDE = 'docs/guide';

export const GROUPS = ['Getting started', 'Guides', 'Reference', 'More'] as const;
export type DocGroup = (typeof GROUPS)[number];

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  group: DocGroup;
  order: number;
  /** Repository path, for "Edit on GitHub". */
  source: string;
  markdown: string;
}

/** The small frontmatter these files use: `key: value` lines between `---`. */
function frontmatter(text: string): { data: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return { data: {}, body: text };
  const data: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { data, body: text.slice(match[0].length) };
}

export function loadDocs(): DocPage[] {
  const dir = path.join(ROOT, GUIDE);
  const pages = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file): DocPage => {
      const { data, body } = frontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
      const group = data.group as DocGroup;
      if (!GROUPS.includes(group)) throw new Error(`${file}: unknown group "${data.group}"`);
      return {
        slug: file.replace(/\.md$/, ''),
        title: data.title ?? file,
        description: data.description ?? '',
        group,
        order: Number(data.order ?? 99),
        source: `${GUIDE}/${file}`,
        markdown: body.trim(),
      };
    });
  return pages.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.order - b.order);
}

/** `./promises.md#return-value` -> `<base>promises#return-value`, for pages that exist. */
function guideLinks(slugs: Set<string>, base: string) {
  return () => (tree: any) => {
    const walk = (node: any) => {
      if (node.type === 'link' && typeof node.url === 'string') {
        const match = /^\.\/([a-z0-9-]+)\.md(#.*)?$/.exec(node.url);
        if (match && slugs.has(match[1]!)) node.url = `${base}${match[1]}${match[2] ?? ''}`;
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

export async function renderDocs(pages: DocPage[], base: string) {
  const renderer = await unified({
    remarkPlugins: [guideLinks(new Set(pages.map((p) => p.slug)), base), relativeLinksToGitHub],
  }).createRenderer({ shikiConfig: { theme: 'github-dark-dimmed' } });
  return Promise.all(
    pages.map(async (p) => {
      const { code, metadata } = await renderer.render(p.markdown);
      return { ...p, html: code, headings: metadata.headings.filter((h) => h.depth === 2) };
    }),
  );
}
