import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { relativeLinksToGitHub } from './src/lib/remark-github-links.mjs';

// Served from GitHub Pages under the repository name.
export default defineConfig({
  site: 'https://vanitascaesar1.github.io',
  base: '/expo-hot-toast',
  markdown: {
    // The docs page renders the repository README, whose relative links point
    // at files in the repo rather than pages on this site.
    processor: unified({ remarkPlugins: [relativeLinksToGitHub] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
    },
  },
  vite: {
    // The README lives one directory up.
    server: { fs: { allow: ['..'] } },
  },
});
