import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The library's web build, exported by CI into public/playground. Its script
 * tag names the hashed bundle, which the live toasts load (see lib/live.ts).
 */
export function toasterScript(): string | undefined {
  try {
    // From the project root: at build time this module runs from a bundled
    // chunk, so a path relative to it points into the build output.
    const html = readFileSync(join(process.cwd(), 'public/playground/index.html'), 'utf8');
    return html.match(/<script src="([^"]+)"/)?.[1];
  } catch {
    return undefined;
  }
}
