import { defineConfig } from 'vitest/config';

const mock = (name: string) => ({
  find: new RegExp(`^${name.replace('/', '\\/')}$`),
  replacement: new URL(`./__mocks__/${name}.ts`, import.meta.url).pathname,
});

/**
 * The store, reducer and toast API are plain TypeScript with no React Native
 * runtime needs — except for two lazy requires (PixelRatio in defaults.ts, and
 * Easing from Reanimated) plus the peer imports in the component layer.
 *
 * Stubbing the native peers keeps the suite fast and, more usefully, lets it
 * run in plain Node, where a React Native install cannot load at all. These go
 * under `test.alias` rather than `resolve.alias` because Vitest resolves test
 * imports through its own pipeline and does not honour the top-level list.
 */
const aliases = [
  mock('react-native'),
  mock('react-native-reanimated'),
  mock('expo-glass-effect'),
  mock('expo-haptics'),
  mock('react-native-safe-area-context'),
  mock('react-native-gesture-handler'),
  mock('react-native-svg'),
];

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    alias: aliases,
  },
});