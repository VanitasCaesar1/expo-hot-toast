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
// Only the app's node_modules. Everything the library imports is a peer the app
// already installs; the library's own node_modules holds devDependency copies
// of those peers for its tests, and they must never reach this bundle.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

// Map the bare specifier onto the library root. Preferred over a `file:..`
// dependency because npm would install a copy rather than link the working
// tree, so source edits would need a reinstall to take effect.
config.resolver.extraNodeModules = {
  'expo-hot-toast': libraryRoot,
};

// `nodeModulesPaths` alone is not enough: Expo's resolver still walks up from a
// file under ../src and finds ../node_modules first. That put two copies of
// Reanimated in the bundle (crash on launch: "Tried to register two views with
// the same name REASharedTransitionBoundary") and the library's
// gesture-handler 2.x beside the app's 3.x native module. Every peer the
// library imports is therefore pinned to the app's copy explicitly.
const peers = [
  'react',
  'react-native',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-gesture-handler',
  'react-native-safe-area-context',
  'react-native-svg',
  'expo-glass-effect',
  'expo-haptics',
];
const appModules = path.resolve(projectRoot, 'node_modules');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const peer = peers.find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  if (peer && !context.originModulePath.startsWith(appModules)) {
    return context.resolveRequest(
      context,
      path.join(appModules, moduleName),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
