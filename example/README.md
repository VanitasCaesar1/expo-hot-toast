# Example app

Exercises every public surface of the library: all six positions, `toast.promise`
resolving and rejecting, queue bursts that exceed the limit, drag-to-dismiss,
press-and-hold pause, and an explicit `glass={false}` toast to show the opaque
fallback side by side with real glass.

```sh
cd example
npm install
npx expo run:ios
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

## Known toolchain blocker

As of the last attempt, `npx expo run:ios` still fails on two **toolchain**
issues that are unrelated to the library:

```
❌  Script '[CP-User] Build ExpoModulesJSI xcframework' failed
❌  (node_modules/react-native/ReactCommon/hermes/inspector-modern/chrome/
      Registration.h:16:10)
```

Both are native build failures in React Native 0.86 / Expo 57 under Xcode 27, not
in `expo-hot-toast` — no source file of the library is implicated. Until they
resolve, the app cannot be launched here and the visual behaviour of the glass
stack remains unverified on device. See the "Known limitations" section of the
root README.

The JavaScript bundle itself is fine: `npx expo config` validates, the example
typechecks against the library's real types (`npm run typecheck:example` from
the repo root), and all component behaviour is covered by the Jest suite in
`__tests__`.

## Why `.npmrc` is duplicated here

`legacy-peer-deps=true` is set in both the root and this directory. npm reads
`.npmrc` from the project it is invoked in, not from the parent — verified:
inside this directory `npm config get legacy-peer-deps` returns `false` without
a local file, so the root setting does not reach this tree. This app has the
same `react-native-worklets@0.13` versus `expo-modules-core` peer conflict as
the root, so it needs its own copy. See "Dependency resolution" in the root
README.
