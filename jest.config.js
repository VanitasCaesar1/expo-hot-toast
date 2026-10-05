/**
 * Component and integration tests run on the real React Native renderer via
 * jest-expo, so they exercise genuine host components and real style
 * resolution rather than string host stubs.
 *
 * The pure-logic suite (reducer, option resolution, promise, routing, theme)
 * stays on Vitest, which is an order of magnitude faster for tests that need no
 * renderer at all. Both are wired into `npm test`.
 */
module.exports = {
  preset: 'jest-expo',
  /**
   * Reanimated 4 delegates to react-native-worklets, whose native build reads
   * `global.__workletsModuleProxy` at import time — which does not exist under
   * Jest, so the suite dies before a single test runs. Its shipped resolver
   * strips the `.native` extension from those requests and loads the plain
   * build instead, which is inert and safe to import.
   */
  resolver: 'react-native-reanimated/jest/resolver.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
};