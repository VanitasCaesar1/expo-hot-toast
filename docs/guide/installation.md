---
title: Installation
description: Install the package and its peer dependencies, and set up the app root.
group: Getting started
order: 2
steps: true
---

## Install the package

> [!NOTE]
> It is not on npm yet. Install it from GitHub; npm builds it after cloning,
> which takes a minute or two.

```sh
npm install github:VanitasCaesar1/expo-hot-toast
```

## Install the peer dependencies

```sh
npx expo install expo-glass-effect expo-haptics react-native-reanimated \
  react-native-worklets react-native-gesture-handler \
  react-native-safe-area-context react-native-svg
```

> [!TIP]
> Use `npx expo install` rather than `npm install`, so you get the versions
> that match your Expo SDK.

## Check the Babel plugin

**Expo:** nothing to do. `babel-preset-expo` adds the Worklets plugin
automatically when `react-native-worklets` is installed.

**React Native without Expo's preset:** add the plugin last in
`babel.config.js`:

```js title="babel.config.js"
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

## Wrap the app root

Gestures need a `GestureHandlerRootView` at the root, and the Toaster reads
safe-area insets from a `SafeAreaProvider`. Expo Router already renders a
`SafeAreaProvider`; add the other.

```tsx title="App.tsx" {3,10}
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'expo-hot-toast';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Home />
        <Toaster />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Render `<Toaster />` once, after the rest of the app, so toasts draw on top.

## Requirements

| | |
|---|---|
| Expo SDK | 55 or later (tested on 57) |
| React Native | 0.80 or later (tested on 0.86) |
| React | 19 |
| Liquid Glass | An app built with the iOS 26 SDK (Xcode 26 or later), running on iOS 26 |

Everything else falls back to the opaque surface, so the same build runs on
older iOS and on Android.

## Next

[Show your first toast](./quick-start.md).
