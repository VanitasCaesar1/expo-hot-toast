/**
 * The AI chats the docs open, with their own logos (from LobeHub's icon set,
 * MIT; the marks belong to their companies). Each takes a prompt and opens a
 * new chat with it filled in.
 */
import openai from '../assets/ai/openai.svg?raw';
import claude from '../assets/ai/claude-color.svg?raw';
import perplexity from '../assets/ai/perplexity-color.svg?raw';
import grok from '../assets/ai/grok.svg?raw';

export interface AiChat {
  id: string;
  name: string;
  /** Inline SVG, sized by CSS. */
  logo: string;
  url: (prompt: string) => string;
}

// T3 Chat publishes no mark in the set; a monogram in its colours stands in.
const t3 = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6" fill="#a23b72"/><text x="12" y="16.2" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10.5" font-weight="800" fill="#fff">T3</text></svg>`;

const q = encodeURIComponent;

export const AI_CHATS: AiChat[] = [
  { id: 'chatgpt', name: 'ChatGPT', logo: openai, url: (p) => `https://chatgpt.com/?hints=search&q=${q(p)}` },
  { id: 'claude', name: 'Claude', logo: claude, url: (p) => `https://claude.ai/new?q=${q(p)}` },
  { id: 't3', name: 'T3 Chat', logo: t3, url: (p) => `https://t3.chat/new?q=${q(p)}` },
  { id: 'perplexity', name: 'Perplexity', logo: perplexity, url: (p) => `https://www.perplexity.ai/search/new?q=${q(p)}` },
  { id: 'grok', name: 'Grok', logo: grok, url: (p) => `https://grok.com/?q=${q(p)}` },
];

/** Strips the fixed 1em size, so CSS sizes every logo alike. */
export function logoSvg(svg: string): string {
  return svg.replace(/\s(width|height)="1em"/g, '').replace('<svg', '<svg aria-hidden="true" focusable="false"');
}
