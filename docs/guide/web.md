---
title: Web apps
description: Use the same toasts in a plain React app (Next.js, Vite) with no React Native.
group: Getting started
order: 2.5
---

`expo-hot-toast/web` is the library for React DOM apps: Next.js, Vite, Remix,
or anything else that renders with `react-dom`. It is the same `toast()` API,
store, queue, presets, rich toasts and theme tokens as the native build, drawn
with DOM and CSS in the same frosted glass. It needs no React Native, React
Native Web or Reanimated.

> [!NOTE]
> An Expo app that also runs on the web does not need this entry. The main
> `expo-hot-toast` import already works there, through React Native Web.

## Install

```sh
npm install github:VanitasCaesar1/expo-hot-toast
```

The React Native packages are optional peers, so a web app installs none of
them. The only peers it needs are `react` and `react-dom` 19.

## Add the Toaster

```tsx title="app/layout.tsx (Next.js)"
import { Toaster } from 'expo-hot-toast/web';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

The bundle starts with `'use client'`, which the App Router needs for a client
component. Its stylesheet comes with the Toaster as a React 19 hoisted
`<style>`; there is no CSS file to import.

## Show a toast

```tsx
import { toast } from 'expo-hot-toast/web';

toast.success('Changes saved');

const upload = toast.progress('Uploading 4 photos');
upload.set(0.4);
upload.success('4 photos uploaded');
```

Everything in [Toast API](./toast-api.md) and [Rich toasts](./rich-toasts.md)
works the same.

## What is different on the web

| | Native | Web |
|---|---|---|
| Surface | Liquid Glass on iOS 26, opaque elsewhere | Frosted glass (CSS backdrop blur); opaque without `backdrop-filter` or with reduced transparency |
| Default preset | Material snackbar on Android, glass pill elsewhere | Glass pill; `preset="material"` for the snackbar |
| `style` options | React Native styles | CSS: `toast('Hi', { style: { borderRadius: 8 } })` |
| `classNames` | Needs NativeWind or Uniwind | Plain `className`: Tailwind and any CSS work |
| Pausing | Press and hold | Hover, or press and hold on touch screens |
| Haptics | expo-haptics | None |
| Safe areas | From `react-native-safe-area-context` | CSS `env(safe-area-inset-*)` |
| `stacked`, `blur`, `ContainerComponent` | Supported | Not available |

## Size

About 16 KB minified and gzipped, every rich toast type included. React and
React DOM are the only dependencies.

## Try it

The repository has a small Vite app with every toast type, light and dark,
and the presets:

```sh
npm run web:example
```
