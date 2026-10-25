---
title: Customising
description: Presets, animations, icons, styling each part, NativeWind, unstyled toasts, fonts, haptics, and matching your app's theme.
group: Guides
order: 6.5
---

Toasts should look right in your app without any setup, and match it closely
with a little. This page goes from the broadest change to the finest.
[Theming](./theming.md) covers the tokens themselves.

## Presets

A preset is the look a Toaster starts from:

```tsx
<Toaster preset="auto" />       // the default
<Toaster preset="glass" />      // the pill everywhere
<Toaster preset="material" />   // the Material 3 snackbar everywhere
```

`auto` gives each platform its own convention: on Android, a Material 3
snackbar (full width less a margin, 4dp corners, the inverse surface, rising
from the bottom); on iOS and the web, the glass pill at the top. `theme` is laid
over the preset, so you only override what differs.

With the Material preset the default position is `bottom-center`. Passing
`position` still wins.

## Animation

```tsx
<Toaster animation="slide" />
```

| Value | Motion |
|---|---|
| `hot` | react-hot-toast's overshooting pop; the default |
| `slide` | In from the edge by its full height, no scale |
| `fade` | In place, opacity only |
| `pop` | From small to full size, in place |
| `none` | Appears and leaves at once |

Each sets [motion tokens](./theme-tokens.md#motion), which `theme.motion` can
still adjust. With Reduce Motion on, every animation becomes a fade in place.

## Your own icons

Give each type an icon, and the close button its own, in place of the
built-in glyphs:

```tsx
import { CheckCircle, XCircle, Info, Warning, X } from 'phosphor-react-native';

<Toaster
  icons={{
    success: <CheckCircle weight="fill" color="#34C759" size={22} />,
    error: <XCircle weight="fill" color="#FF3B30" size={22} />,
    info: <Info weight="fill" color="#0A84FF" size={22} />,
    warning: <Warning weight="fill" color="#FF9F0A" size={22} />,
    close: <X size={14} />,
  }}
/>
```

Types you leave out keep the built-in glyph. A toast's own `icon` wins over
the Toaster's, and can be a function of the toast:
`icon: (t) => <StatusDot type={t.type} />`.

## Styling each part

`styles` takes a style for any part of the built-in toast:

```tsx
<Toaster
  toastOptions={{
    styles: {
      toast: { borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA' },
      title: { letterSpacing: -0.2 },
      action: { backgroundColor: '#0A84FF', borderRadius: 8 },
      actionLabel: { color: '#FFFFFF' },
      progressBar: { backgroundColor: '#34C759' },
    },
  }}
/>
```

| Part | What it is |
|---|---|
| `toast` | The surface |
| `content` | The row, or the HUD's column, inside it |
| `icon` | The icon's box |
| `title` | The message |
| `description` | The second line |
| `action`, `actionLabel` | The action button and its text |
| `cancel`, `cancelLabel` | The cancel button and its text |
| `closeButton` | The × |
| `progressTrack`, `progressBar` | The progress bar's track and fill |
| `avatar` | The picture of a notification |
| `timestamp` | The small text at the end of the first line |
| `badge` | The ×N count |
| `expanded` | The box an expandable toast opens |

Styles given in `toastOptions`, per type and per toast all apply, in that
order, so a toast can change one part and keep the rest.

## NativeWind and Uniwind

`classNames` takes a class string for the same parts, for styling libraries
that read `className` on React Native components:

```tsx
<Toaster
  toastOptions={{
    classNames: {
      toast: 'rounded-xl border border-zinc-200 dark:border-zinc-800',
      title: 'font-semibold text-zinc-900 dark:text-zinc-50',
      description: 'text-zinc-500',
      action: 'bg-blue-500 rounded-lg',
    },
  }}
/>
```

Class strings from each level are joined, not replaced. Without such a
library, `classNames` does nothing. On the web build (`expo-hot-toast/web`)
they are ordinary `className`s, so Tailwind or any CSS works as is.

In React Native an inline style beats a class, so a part given a class drops
the token styles a class would set: a `title` class replaces the title's
colour, size, weight and font tokens, and `unstyled` leaves the toast's
padding and corners to your classes. `styles` still wins over both.

Checked with Uniwind and Tailwind 4 on Android: background, border, padding,
corners and text classes all reach the toast.

## Unstyled

`unstyled` drops the built-in surface: no fill, glass, border, shadow or
padding. The toast keeps its layout, gestures, timing and accessibility, and
you draw the rest:

```tsx
<Toaster
  toastOptions={{
    unstyled: true,
    classNames: {
      toast: 'bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-lg',
      title: 'text-sm font-medium text-zinc-900 dark:text-zinc-50',
    },
  }}
/>
```

For full control over what a toast contains, see
[Custom rendering](./custom-rendering.md).

## Fonts and lines

```tsx
<Toaster
  theme={{
    fontFamily: 'Inter-Medium',
    descriptionFontFamily: 'Inter-Regular',
    actionFontFamily: 'Inter-SemiBold',
    maxLines: 2,
    descriptionMaxLines: 4,
  }}
/>
```

On Android a custom font is usually one family per weight, so give the family
that matches `fontWeight`. `maxLines: 0` removes the limit.

With Bold Text on (iOS: Settings, Accessibility, Display & Text Size), every
weight in the toast steps up one notch, as system text does.

## Haptics

`true` plays each type's default: light for success, rigid for error, the
warning pattern for warnings, nothing for info and loading. A map picks per
type, and a toast can pick its own:

```tsx
<Toaster haptics={{ success: 'medium', error: 'error', info: 'light' }} />

toast.success('Payment sent', { haptics: 'success' });
toast('Copied', { haptics: false });
```

Android has no weighted impacts, so `light`, `medium`, `heavy`, `rigid` and
`soft` play the notification pattern for the toast's outcome there.

## Blur on Android

Android and iOS before 26 have no Liquid Glass, so toasts there draw an opaque
surface. To draw them on a blur instead, pass a blur view you already use. The
library does not depend on one:

```tsx title="App.tsx"
import { useRef } from 'react';
import { BlurTargetView, BlurView } from 'expo-blur';
import { Toaster } from 'expo-hot-toast';

export default function App() {
  const blurTarget = useRef(null);
  return (
    <>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
        <Navigation />
      </BlurTargetView>
      <Toaster
        blur={{
          component: BlurView,
          props: { intensity: 40, blurMethod: 'dimezisBlurViewSdk31Plus', blurTarget },
        }}
      />
    </>
  );
}
```

On Android, expo-blur blurs what is inside a `BlurTargetView`, so wrap your
screens in one and keep the Toaster outside it. The blur fills the toast's
shape, takes the colour scheme as its `tint` unless `props` sets one, and has
the translucent `background` token over it. Reduce Transparency, and
`glass: false` on a toast, still give the opaque surface. On iOS 26 Liquid Glass
is used and the blur is ignored.

## Matching your app's theme

If your app has a theme, toasts can take their colours from it instead of
keeping a second palette in step.

From React Navigation:

```tsx
import { useTheme } from '@react-navigation/native';
import { Toaster, fromNavigationTheme } from 'expo-hot-toast';

function AppToaster() {
  return <Toaster {...fromNavigationTheme(useTheme())} />;
}
```

From a few colours of your own design system (Tamagui, Unistyles, a constants
file):

```tsx
import { Toaster, themeFromColors } from 'expo-hot-toast';

<Toaster
  theme={themeFromColors({
    background: colors.card,
    text: colors.text,
    mutedText: colors.textSecondary,   // optional: text at 70%
    accent: colors.primary,            // optional: the action colour
    border: colors.separator,          // optional: text at 12%
    radius: 14,
    fontFamily: 'Inter-Medium',
  })}
/>
```

Both return ordinary theme tokens, so you can spread more over them. With
`glass` on, Liquid Glass draws its own material over the fill; set
`glass={false}` if the toast should be exactly your surface colour.
