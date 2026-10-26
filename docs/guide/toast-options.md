---
title: Toast options
description: Every option a toast accepts, with its type and default.
group: Reference
order: 2
---

Pass these as the second argument to `toast()`, or as defaults in
`<Toaster toastOptions>`, where they can also be grouped by type
(`success`, `error`, `info`, `warning`, `loading`, `blank`, `custom`). A toast's own options win.

## Content

| Option | Type | Default | |
|---|---|---|---|
| `id` | `string` | generated | Reuse an id to update that toast in place |
| `description` | `ReactNode` | none | A second, quieter line under the message |
| `icon` | `ReactNode`, or `(toast) => ReactNode` | per type | Replaces the built-in icon; `null` hides it |
| `iconTheme` | `{ primary, secondary }` | per type | `primary` colours the built-in glyph and spinner |
| `action` | `{ label, onPress, color?, countdown? }` | none | A trailing button; the toast dismisses after `onPress`. `countdown: true` drains a ring around it over the time left |
| `cancel` | `{ label, onPress, color? }` | none | A quieter button before `action`, for "Cancel / Delete" pairs |
| `closeButton` | `boolean` | `false` | A trailing × button |
| `closeButtonColor` | `string` | theme `color` | Colour of the × |
| `avatar` | image source or `ReactNode` | none | A round picture in place of the icon |
| `timestamp` | `string` | none | Small text at the end of the first line ("now", "2/4") |
| `expandable` | `{ content, label?, defaultExpanded? }` | none | A toggle that shows more below; the toast pauses while open |

## Progress

| Option | Type | Default | |
|---|---|---|---|
| `progress` | `number` (0 to 1) or `'indeterminate'` | none | Shows a bar; prefer [`toast.progress`](./rich-toasts.md#progress), which updates on the UI thread |
| `progressStyle` | `'bar'` or `'ring'` | `'bar'` | A bar along the bottom edge, or a ring around the icon |
| `progressSegments` | `number` | none | Splits the bar into steps |

## Timing and placement

| Option | Type | Default | |
|---|---|---|---|
| `duration` | `number`, `'short'`, `'long'` or `'infinite'` | 4000; success 2000; loading infinite | Milliseconds, or 2000 / 4500 / never |
| `position` | `ToastPosition` | the Toaster's | One of the six positions |
| `toasterId` | `string` | `'default'` | Which Toaster shows it |
| `dedupeKey` | `string` | none | Skip this toast if one with the same key is on screen, and count the repeat |
| `dedupeWindowMs` | `number` | `1000` | How long a key counts as on screen |
| `removeDelay` | `number` | the exit duration (400) | How long a dismissed toast stays mounted |

## Behaviour

| Option | Type | Default | |
|---|---|---|---|
| `dismissOnTap` | `boolean` | `true` on Android (except a toast with progress), `false` on iOS | Tap to dismiss |
| `onPress` | `() => void` | none | Tapping the toast calls this, then dismisses it |
| `dismissible` | `boolean` | `true` | `false` turns off swipe and tap to dismiss; a button or the timer still can |
| `swipeDirections` | `SwipeDirection[]` | toward its edge, and right (left in right-to-left layouts); left and right for a snackbar | Which ways a swipe dismisses |
| `onDismiss` | `(id, reason) => void` | none | Called once the toast has left, with why |
| `haptics` | `boolean` or `ToastHaptic` | the Toaster's | `false` for silence, or a named haptic: `'light'`, `'medium'`, `'heavy'`, `'rigid'`, `'soft'`, `'success'`, `'warning'`, `'error'` |
| `important` | `boolean` | `true` for errors | Interrupt other announcements (Android) |
| `accessibilityLabel` | `string` | the message text | What screen readers announce |

## Appearance

| Option | Type | Default | |
|---|---|---|---|
| `variant` | `'auto'`, `'pill'`, `'snackbar'`, `'card'`, `'banner'`, `'hud'` or `'island'` | `'auto'` | The toast's shape; see [Rich toasts](./rich-toasts.md#shapes) |
| `theme` | partial [theme tokens](./theme-tokens.md) | none | Token overrides for this toast |
| `glass` | `boolean` or `GlassConfig` | the Toaster's | `false` draws the opaque surface |
| `richColors` | `boolean` | `false` | Tinted surface and text for success, error, info and warning toasts |
| `style` | `ViewStyle` | none | The toast surface, applied after tokens |
| `textStyle` | `TextStyle` | none | The message |
| `iconStyle` | `ViewStyle` | none | The icon's box |
| `styles` | `{ [slot]: style }` | none | A style for any part; see [Customising](./customizing.md#styling-each-part) |
| `classNames` | `{ [slot]: string }` | none | A `className` for any part, for NativeWind or Uniwind |
| `unstyled` | `boolean` | `false` | Draw no surface, padding or shadow; bring your own through `styles` |

`closeable` still works as a deprecated name for `closeButton`.
