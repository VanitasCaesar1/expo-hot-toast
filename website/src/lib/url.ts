/** A path under the site's base (GitHub Pages serves it from /expo-hot-toast). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export const REPO_URL = 'https://github.com/VanitasCaesar1/expo-hot-toast';
export const INSTALL = 'npm install github:VanitasCaesar1/expo-hot-toast';
