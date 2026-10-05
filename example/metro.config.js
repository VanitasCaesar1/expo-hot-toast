const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// The library lives one directory up rather than in node_modules, so Metro has
// to be told to watch it and to resolve React from a single copy. Two Reacts in
// one bundle produce a second hooks dispatcher and "invalid hook call" at
// runtime, which is exactly the failure a monorepo Expo app hits by default.
config.watchFolders = [libraryRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(libraryRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Map the bare specifier onto the library root. Preferred over a `file:..`
// dependency because npm would install a copy rather than link the working
// tree, so source edits would need a reinstall to take effect.
config.resolver.extraNodeModules = {
  'expo-hot-toast': libraryRoot,
};

module.exports = config;