import { loadDocs } from '../lib/docs';
import { url } from '../lib/url';

/** Every page on the site, for search engines. */
export function GET({ site }: { site: URL | undefined }) {
  const origin = site ?? new URL('https://vanitascaesar1.github.io');
  const pages = [url(), url('docs'), ...loadDocs().map((page) => url(`docs/${page.slug}`))];
  const entries = pages.map((path) => `  <url><loc>${new URL(path, origin).href}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
