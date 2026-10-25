/**
 * The site's light and dark themes.
 *
 * The visitor's choice is 'light', 'dark' or 'system' (the default), kept in
 * localStorage. An inline script in Base.astro applies it before first paint,
 * so no page ever flashes the other theme; this module changes it afterwards
 * and tells the rest of the page through a `site:theme` event.
 */
export type ThemePref = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

const KEY = 'eht-theme';
const media = () => window.matchMedia('(prefers-color-scheme: light)');

export function getPref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage blocked: follow the system.
  }
  return 'system';
}

export function getScheme(): Scheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function apply(pref: ThemePref): void {
  const scheme: Scheme = pref === 'system' ? (media().matches ? 'light' : 'dark') : pref;
  const root = document.documentElement;
  root.dataset.theme = scheme;
  root.dataset.themePref = pref;
  root.setAttribute('data-lg-theme', scheme);
  window.dispatchEvent(new CustomEvent<Scheme>('site:theme', { detail: scheme }));
}

export function setPref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Not remembered; still applied for this page.
  }
  apply(pref);
}

/** Calls `listener` with the scheme whenever it changes. */
export function onScheme(listener: (scheme: Scheme) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<Scheme>).detail);
  window.addEventListener('site:theme', handler);
  return () => window.removeEventListener('site:theme', handler);
}

let watching = false;

/** Follows the system's appearance while the visitor has not picked one. */
export function watchSystem(): void {
  if (watching) return;
  watching = true;
  media().addEventListener('change', () => {
    if (getPref() === 'system') apply('system');
  });
}

/** The inline, pre-paint version of `apply`, for Base.astro's <head>. */
export const THEME_SCRIPT = `(function(){var p='system';try{var s=localStorage.getItem('${KEY}');if(s==='light'||s==='dark')p=s}catch(e){}var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var r=document.documentElement;r.dataset.theme=t;r.dataset.themePref=p;r.setAttribute('data-lg-theme',t)})();`;
