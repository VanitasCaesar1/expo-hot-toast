import { defineConfig } from 'vite';

/**
 * Builds `lib/web`: the DOM build for plain React apps. The shared core's few
 * React Native and Reanimated imports point at small browser shims, so the
 * bundle needs only React and React DOM.
 */
const shim = (name: string) => new URL(`./src/web/shims/${name}.ts`, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: shim('react-native') },
      { find: /^react-native-reanimated$/, replacement: shim('reanimated') },
    ],
  },
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: 'lib/web',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    target: 'es2020',
    lib: {
      entry: new URL('./src/web/index.ts', import.meta.url).pathname,
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: {
        // Client components in the Next.js App Router.
        banner: "'use client';",
        exports: 'named',
      },
    },
  },
});
