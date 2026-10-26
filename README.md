# expo-hot-toast

[![CI](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ci.yml/badge.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ci.yml)
[![iOS](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ios.yml/badge.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ios.yml)
[![Android](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/android.yml/badge.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/LICENSE)

Toasts for Expo and React Native, with the react-hot-toast API. On iOS 26 each
toast is drawn in Apple's own Liquid Glass, on Android as a Material 3
snackbar, and on the web in frosted glass. Beyond plain toasts: progress,
steps, Undo with a countdown, notifications, a HUD and a Dynamic Island
capsule. Plain React web apps get the same API through `expo-hot-toast/web`.

**[Try it on the website](https://vanitascaesar1.github.io/expo-hot-toast/)**: every
button there fires a real toast, from this library running in your browser.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VanitasCaesar1/expo-hot-toast/main/docs/media/demo-dark.webp" />
    <img src="https://raw.githubusercontent.com/VanitasCaesar1/expo-hot-toast/main/docs/media/demo-light.webp" width="636" alt="The same toasts on an iPhone in Liquid Glass and on Android as Material 3 snackbars" />
  </picture>
  <br />
  <sub>iPhone (iOS 26.5, Liquid Glass) and Android 15 (Material 3), screen recordings from CI</sub>
</p>

**[Documentation](https://vanitascaesar1.github.io/expo-hot-toast/docs/)** ·
[Website](https://vanitascaesar1.github.io/expo-hot-toast/)

## Install

Not on npm yet; install from GitHub, then add the peer dependencies:

```sh
npm install github:VanitasCaesar1/expo-hot-toast
npx expo install expo-glass-effect expo-haptics react-native-reanimated \
  react-native-worklets react-native-gesture-handler \
  react-native-safe-area-context react-native-svg
```

[Installation](https://vanitascaesar1.github.io/expo-hot-toast/docs/installation/) covers the app root and
React Native without Expo.

## Use

Mount one `<Toaster />` at the root, then call `toast` from anywhere:

```tsx
import { Toaster, toast } from 'expo-hot-toast';

export default function App() {
  return (
    <>
      <Home />
      <Toaster />
    </>
  );
}

toast.success('Changes saved');
toast.error('Could not reach the server');
toast('Message archived', { action: { label: 'Undo', onPress: restore } });

await toast.promise(upload(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
});
```

## What you get

- **Liquid Glass on iOS 26**, through `expo-glass-effect`. Older iOS, Android
  and Reduce Transparency get an opaque surface; nothing imitates glass. The
  web gets frosted glass, a CSS backdrop blur.
- **A queue, not a pile.** Three toasts per position, first come, first shown;
  the rest wait their turn and get their full time once they show. Errors go
  first.
- **Gestures.** Swipe to dismiss; press and hold to pause every timer.
- **Actions, a close button and deduplication**, so Undo works and twenty
  identical calls show one toast.
- **More than a line of text**: progress bars and rings that fill on the UI
  thread, named steps, expandable details, Undo with a countdown, cancel and
  confirm, notifications with an avatar, banners, a HUD and a Dynamic Island
  capsule. See [Rich toasts](https://vanitascaesar1.github.io/expo-hot-toast/docs/rich-toasts/).
- **Plain React web apps too**: `expo-hot-toast/web` is the same API in
  Next.js or Vite, drawn with DOM and CSS in the same frosted glass, with no
  React Native. See [Web apps](https://vanitascaesar1.github.io/expo-hot-toast/docs/web/).
- **Native by default, yours if you want**: a Material 3 snackbar on Android and
  the glass pill on iOS, or one everywhere; your own icons; a style or
  NativeWind class for every part; or no built-in look at all. Themes from React
  Navigation or a few colours. See [Customising](https://vanitascaesar1.github.io/expo-hot-toast/docs/customizing/).
- **Accessibility**: screen reader announcements, Reduce Motion, Reduce
  Transparency, Bold Text, capped text size, and haptics for outcomes.
- **Tokens** for every colour, size and duration, in light and dark.

## More than a line of text

<p align="center">
  <img src="https://raw.githubusercontent.com/VanitasCaesar1/expo-hot-toast/main/docs/media/rich-dark.webp" width="636" alt="Upload progress, steps, Undo with a countdown, a notification, the island, a HUD and a banner, on iPhone and Android" />
  <br />
  <sub>Progress, steps, Undo with a countdown, a notification, the island, a HUD and a banner. Recorded in CI.</sub>
</p>

```tsx
const upload = toast.progress('Uploading 4 photos');
upload.set(0.4);                       // on the UI thread, no re-render
upload.success('4 photos uploaded');

toast.steps(['Compressing video', 'Uploading', 'Processing']);
toast('Conversation deleted', { action: { label: 'Undo', countdown: true, onPress: restore } });
toast.notify({ title: 'Maya Patel', body: 'Sent you 4 photos', avatar: { uri } });
toast.hud('Added to Library');
toast.island('AirPods Pro connected', { type: 'success' });
```

See [Rich toasts](https://vanitascaesar1.github.io/expo-hot-toast/docs/rich-toasts/).

## Coming from react-hot-toast

react-hot-toast is web-only: it renders DOM elements. This package rebuilds its
API on native views, so toast code from a React web app ports by changing the
import. [The differences](https://vanitascaesar1.github.io/expo-hot-toast/docs/coming-from-react-hot-toast/) fit on one
page.

## Platform support

| Platform | Surface | Tested |
|---|---|---|
| iOS 26 | Liquid Glass | iOS 26.5 simulator in CI |
| Android | Material 3 snackbar, opaque | Android 15 emulator in CI |
| iOS before 26 | Opaque | Not yet |
| Web | Frosted glass | Built for the web in CI; runs the website's demos |

## Requirements

- Expo SDK 55 or later (tested on 57), or React Native 0.80 or later with the
  New Architecture
- Reanimated 4 and `react-native-worklets`
- For Liquid Glass: an app built with Xcode 26 or later, running on iOS 26

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/CONTRIBUTING.md) covers
setup and the test gates. [docs/design.md](https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/docs/design.md) explains the
decisions behind the queue, the timing and the glass.

Please follow the [code of conduct](https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/CODE_OF_CONDUCT.md).

## License

[MIT](https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/LICENSE) © VanitasCaesar1
