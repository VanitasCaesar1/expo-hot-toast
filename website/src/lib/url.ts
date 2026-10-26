/**
 * A path under the site's base (GitHub Pages serves it from /expo-hot-toast).
 * A page's path ends in a slash, as Pages serves it: without one every
 * internal link took a redirect. Files (`media/og.png`) are left as they are.
 */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [, page = '', rest = ''] = path.replace(/^\//, '').match(/^([^#?]*)(.*)$/) ?? [];
  const last = page.split('/').pop() ?? '';
  const slashed = page === '' || page.endsWith('/') || /\.[a-z0-9]+$/i.test(last) ? page : `${page}/`;
  return `${base}/${slashed}${rest}`;
}

export const REPO_URL = 'https://github.com/VanitasCaesar1/expo-hot-toast';
export const INSTALL = 'npm install github:VanitasCaesar1/expo-hot-toast';
