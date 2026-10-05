module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Must stay last. Reanimated's plugin rewrites worklets and depends on
    // every other transform having already run.
    plugins: ['react-native-worklets/plugin'],
  };
};