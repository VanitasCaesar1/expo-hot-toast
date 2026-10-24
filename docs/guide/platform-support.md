---
title: Platform support
description: What has been tested where, and known limitations.
group: More
order: 2
---

## Tested

| Platform | Surface | Status |
|---|---|---|
| iOS 26 | Liquid Glass | The example app runs on an iOS 26.5 simulator in CI, driven by Maestro |
| Android | Opaque | The example app runs on an Android 15 (API 35) emulator in CI, driven by Maestro |
| iOS before 26 | Opaque | Not yet run |
| Web | Opaque | Not yet run |

"Driven by Maestro" means a script taps every row of the example app in light
mode and checks what appears, then repeats a shorter pass in dark mode. The recordings on the
[home page](https://vanitascaesar1.github.io/expo-hot-toast/) come from those runs.

Tested with the versions Expo SDK 57 installs: React Native 0.86,
Reanimated 4.5, Worklets 0.10, Gesture Handler 2.32 and
safe-area-context 5.7.

## Known limitations

- **Native modals cover toasts**, unless you render the Toaster in
  `FullWindowOverlay` on iOS; see [Positions](./positions.md#above-modals-and-sheets).
- **No morphing between toasts.** iOS 26 can morph one glass shape into
  another, but React Native has no way to drive that with glass yet, so toasts
  enter and leave separately.
- **Android draws an opaque surface.** It does not imitate glass.
- **Haptics cannot be turned off** yet.
