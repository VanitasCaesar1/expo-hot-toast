import type { APIRoute } from 'astro';
import { loadDocs } from '../../../lib/docs';
import { pageMarkdown } from '../../../lib/ai';

export function getStaticPaths() {
  return loadDocs().map((p) => ({ params: { slug: p.slug } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(pageMarkdown(params.slug!), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
