import { defineConfig } from 'vite';

/**
 * A plain React DOM app using the web build straight from source. It aliases
 * `expo-hot-toast/web` to `src/web` and the core's React Native imports to the
 * shims, exactly as the published bundle is built. `npm run web:example`.
 */
const root = new URL('..', import.meta.url).pathname;

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  resolve: {
    alias: [
      { find: /^expo-hot-toast\/web$/, replacement: `${root}src/web/index.ts` },
      { find: /^react-native$/, replacement: `${root}src/web/shims/react-native.ts` },
      { find: /^react-native-reanimated$/, replacement: `${root}src/web/shims/reanimated.ts` },
    ],
  },
  esbuild: { jsx: 'automatic' },
  build: { outDir: new URL('./dist', import.meta.url).pathname, emptyOutDir: true },
});
