import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import { relativeLinksToGitHub } from './src/lib/remark-github-links.mjs';

// Served from GitHub Pages under the repository name.
export default defineConfig({
  site: 'https://vanitascaesar1.github.io',
  base: '/expo-hot-toast',
  // React only for the interactive islands: the Glassy UI controls.
  integrations: [react()],
  markdown: {
    // Markdown on this site comes from the repository (docs/guide), so links to
    // other repository files go to GitHub.
    processor: unified({ remarkPlugins: [relativeLinksToGitHub] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
    },
  },
  vite: {
    // The docs live one directory up, in docs/guide.
    server: { fs: { allow: ['..'] } },
    // The live toasts are the library's DOM build, from its source one
    // directory up, with the core's React Native imports on the web shims
    // (as vite.config.web.ts builds it). One React for the site and library.
    resolve: {
      alias: [
        { find: /^expo-hot-toast\/web$/, replacement: new URL('../src/web/index.ts', import.meta.url).pathname },
        { find: /^react-native$/, replacement: new URL('../src/web/shims/react-native.ts', import.meta.url).pathname },
        { find: /^react-native-reanimated$/, replacement: new URL('../src/web/shims/reanimated.ts', import.meta.url).pathname },
      ],
      dedupe: ['react', 'react-dom'],
    },
  },
});
