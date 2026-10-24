# Example app

A single plain screen for trying the library and for recording demos, with one
row per feature: success, error, `toast.promise` resolving and rejecting, an
Undo action, a burst that fills the queue, deduplication, a bottom toast, the
opaque surface, a close button and a custom element. It follows the system
light/dark setting.

```sh
cd example
npm install
npx expo run:ios        # or: npx expo run:android
```

## Automated run

`.maestro/smoke.yaml` taps through every row and screenshots the result, and
`.maestro/dark.yaml` repeats the main surfaces in dark mode. CI runs both on an
Android emulator (`.github/workflows/android.yml`) through
`scripts/android-smoke.sh`. With [Maestro](https://maestro.mobile.dev) installed
and the app running on a simulator or emulator, run them locally with:

```sh
maestro test .maestro/smoke.yaml
```

## Version pins that are not optional

Two of these look cosmetic and are not. Both were found by attempting a real
native build, and neither fails in a way that points at its own cause.

**`react-native-worklets` must match your Reanimated minor.** Reanimated 4.0.3's
podspec runs `validate-worklets-build.js` and hard-fails with
`[Reanimated] Failed to validate worklets version`. A `"*"` range silently
installs a much newer worklets that Reanimated rejects, so pin it:

```sh
node node_modules/react-native-reanimated/scripts/validate-worklets-build.js
```

Run that after any dependency bump — it is the fastest way to check the pair.

**`react-native-safe-area-context` must be new enough for your RN's Yoga.** RN
0.86 changed `yoga::StyleLength`, and safe-area-context 5.0.0 fails to compile
against it:

```
RNCSafeAreaViewShadowNode.cpp:19:12: error: no member named 'unit' in
  'facebook::yoga::StyleLength'
```

`~5.10.0` resolves correctly.

## Building under Xcode 27 (verified 2026-10-24)

The app builds and runs on an iOS 26.5 simulator with Xcode 27.1, but needs two
workarounds for **toolchain** issues in Expo 57 / React Native 0.86 — no file of
`expo-hot-toast` is involved. `example/ios` is generated and git-ignored, so
both have to be reapplied after `npx expo prebuild --clean` or a reinstall.

1. **Build Expo modules from source.** The precompiled Expo xcframeworks were
   built with Swift 6.3.1 and Xcode 27 ships Swift 6.4 (`this SDK is not
   supported by the compiler`). Add `"EXPO_USE_PRECOMPILED_MODULES": "false"`
   to `ios/Podfile.properties.json` and run `pod install` in `ios/`.
2. **Patch the ExpoModulesJSI interface.** Swift 6.4 emits a module interface
   for `expo-modules-jsi` that does not compile
   (`cannot find type '__ObjC::expo' in scope`). Delete the four-line
   `extension __ObjC::expo.__ObjC::CppError : Swift::Error { … }` block from the
   `*.swiftinterface` files under
   `node_modules/expo-modules-jsi/apple/Products/ExpoModulesJSI.xcframework`
   and rebuild.

## Metro: one copy of every peer

The library's own `node_modules` contains every peer as a devDependency, and
Expo's resolver walks up from `../src` into it regardless of
`nodeModulesPaths`. Left alone, the bundle gets two copies of Reanimated (the
app crashes on launch with `Tried to register two views with the same name
REASharedTransitionBoundary`) and the library's gesture-handler 2.x next to the
app's 3.x native module. `metro.config.js` therefore pins each peer to the app's
copy in a `resolveRequest`. A consumer app installing the package from npm or
GitHub does not have this problem.

## Why `.npmrc` is duplicated here

`legacy-peer-deps=true` is set in both the root and this directory. npm reads
`.npmrc` from the project it is invoked in, not from the parent — verified:
inside this directory `npm config get legacy-peer-deps` returns `false` without
a local file, so the root setting does not reach this tree. This app has the
same `react-native-worklets@0.13` versus `expo-modules-core` peer conflict as
the root, so it needs its own copy. See "Dependency resolution" in the root
README.
