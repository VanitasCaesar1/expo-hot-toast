/**
 * The docs are the Markdown files in docs/guide, one page each, read at build
 * time. They render on GitHub as well, so links between them are relative
 * `./page.md` links; the site rewrites those to its own pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { unified } from '@astrojs/markdown-remark';
import type { ShikiConfig } from '@astrojs/markdown-remark';
import { relativeLinksToGitHub } from './remark-github-links.mjs';
import { rehypeDocs, rehypeSteps, remarkCodeTitles } from './rehype-docs.mjs';

const ROOT = path.resolve(process.cwd(), '..');
const GUIDE = 'docs/guide';

export const GROUPS = ['Getting started', 'Guides', 'Reference', 'More'] as const;
export type DocGroup = (typeof GROUPS)[number];

/** The sidebar's two tabs, as in Clerk's docs: guides, and the API reference. */
export const TABS = [
  { id: 'guides', label: 'Guides', groups: ['Getting started', 'Guides', 'More'] as DocGroup[] },
  { id: 'reference', label: 'Reference', groups: ['Reference'] as DocGroup[] },
] as const;
export type DocTab = (typeof TABS)[number]['id'];

export function tabOf(group: DocGroup): DocTab {
  return TABS.find((t) => t.groups.includes(group))!.id;
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  group: DocGroup;
  order: number;
  /** Repository path, for "Edit on GitHub". */
  source: string;
  markdown: string;
  /** Each `##` section is a numbered step (frontmatter `steps: true`). */
  steps: boolean;
  /** When the file last changed, from git (YYYY-MM-DD), if known. */
  updated?: string;
}

/** The last commit that touched `file`. CI checks out full history for this. */
function lastChanged(file: string): string | undefined {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' }).trim() || undefined;
  } catch {
    return undefined;
  }
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
        steps: data.steps === 'true',
        updated: lastChanged(`${GUIDE}/${file}`),
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
  const remarkPlugins = [guideLinks(new Set(pages.map((p) => p.slug)), base), relativeLinksToGitHub, remarkCodeTitles];
  // Both themes, as CSS variables; the page's theme picks one.
  const shikiConfig: Partial<ShikiConfig> = { themes: { light: 'github-light', dark: 'github-dark-dimmed' }, defaultColor: false };
  const plain = await unified({ remarkPlugins, rehypePlugins: [rehypeDocs] }).createRenderer({ shikiConfig });
  const stepped = await unified({ remarkPlugins, rehypePlugins: [rehypeDocs, rehypeSteps] }).createRenderer({ shikiConfig });
  return Promise.all(
    pages.map(async (p) => {
      const { code, metadata } = await (p.steps ? stepped : plain).render(p.markdown);
      return { ...p, html: code, headings: metadata.headings.filter((h) => h.depth === 2 || h.depth === 3) };
    }),
  );
}
