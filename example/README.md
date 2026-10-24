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

## Versions

The example uses exactly the versions Expo SDK 57 expects, so
`npx expo install --check` reports nothing. Keep it that way: an earlier version
of this app pinned a pre-SDK 57 `expo-haptics`, whose Android native code was
built against an older `expo-modules-core` and crashed on launch
(`NoClassDefFoundError: expo/modules/kotlin/types/AnyTypeProvider`). iOS did not
show it. After changing a dependency, run:

```sh
npx expo install --check
```

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
