import { llmsFull } from '../lib/ai';

export function GET() {
  return new Response(llmsFull(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
