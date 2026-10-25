/**
 * The repository's star count, for the Star buttons.
 *
 * Read once at build time, so the page has a number before any script runs,
 * then refreshed in the browser from GitHub's public API (cached for the visit,
 * since unauthenticated calls are limited to 60 an hour per visitor).
 */
const API = 'https://api.github.com/repos/VanitasCaesar1/expo-hot-toast';
const CACHE_KEY = 'eht-stars';

let atBuild: Promise<number | undefined> | undefined;

/** At build time. Undefined when GitHub cannot be reached; the buttons then show no count. */
export function buildStars(): Promise<number | undefined> {
  atBuild ??= fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : undefined))
    .then((repo: { stargazers_count?: number } | undefined) => repo?.stargazers_count)
    .catch(() => undefined);
  return atBuild;
}

let live: Promise<number | undefined> | undefined;

/** In the browser: the current count, fetched once per visit. */
export function liveStars(): Promise<number | undefined> {
  if (live) return live;
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached !== null) return (live = Promise.resolve(Number(cached)));
  } catch {
    // Storage blocked; fetch anyway.
  }
  live = fetch(API)
    .then((r) => (r.ok ? r.json() : undefined))
    .then((repo: { stargazers_count?: number } | undefined) => {
      const count = repo?.stargazers_count;
      if (typeof count === 'number') {
        try {
          sessionStorage.setItem(CACHE_KEY, String(count));
        } catch {
          // Not cached; fine.
        }
      }
      return count;
    })
    .catch(() => undefined);
  return live;
}

/** 1234 → "1.2k". */
export function formatStars(count: number): string {
  if (count < 1000) return String(count);
  const k = count / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
}
