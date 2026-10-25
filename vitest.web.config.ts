import { defineConfig } from 'vitest/config';

/**
 * The DOM build's suite: the web renderer in jsdom, with the core's React
 * Native imports pointed at the same shims the published bundle uses.
 */
const shim = (name: string) => new URL(`./src/web/shims/${name}.ts`, import.meta.url).pathname;

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/web/**/*.test.tsx'],
    setupFiles: ['__tests__/web/setup.ts'],
    alias: [
      { find: /^react-native$/, replacement: shim('react-native') },
      { find: /^react-native-reanimated$/, replacement: shim('reanimated') },
    ],
  },
});
