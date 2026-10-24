---
title: Toast options
description: Every option a toast accepts, with its type and default.
group: Reference
order: 2
---

Pass these as the second argument to `toast()`, or as defaults in
`<Toaster toastOptions>`, where they can also be grouped by type
(`success`, `error`, `loading`, `blank`, `custom`). A toast's own options win.

## Content

| Option | Type | Default | |
|---|---|---|---|
| `id` | `string` | generated | Reuse an id to update that toast in place |
| `description` | `ReactNode` | none | A second, quieter line under the message |
| `icon` | `ReactNode` | per type | Replaces the built-in icon; `null` hides it |
| `iconTheme` | `{ primary, secondary }` | per type | `primary` colours the built-in glyph and spinner |
| `action` | `{ label, onPress, color? }` | none | A trailing button; the toast dismisses after `onPress` |
| `closeButton` | `boolean` | `false` | A trailing × button |
| `closeButtonColor` | `string` | theme `color` | Colour of the × |

## Timing and placement

| Option | Type | Default | |
|---|---|---|---|
| `duration` | `number`, `'short'`, `'long'` or `'infinite'` | 4000; success 2000; loading infinite | Milliseconds, or 2000 / 4500 / never |
| `position` | `ToastPosition` | the Toaster's | One of the six positions |
| `toasterId` | `string` | `'default'` | Which Toaster shows it |
| `dedupeKey` | `string` | none | Skip this toast if one with the same key is on screen |
| `dedupeWindowMs` | `number` | `1000` | How long a key counts as on screen |
| `removeDelay` | `number` | the exit duration (400) | How long a dismissed toast stays mounted |

## Behaviour

| Option | Type | Default | |
|---|---|---|---|
| `dismissOnTap` | `boolean` | `true` on Android, `false` on iOS | Tap to dismiss |
| `onDismiss` | `(id, reason) => void` | none | Called once the toast has left, with why |
| `haptics` | `boolean` | the Toaster's (`true`) | Play the success or error haptic |
| `important` | `boolean` | `true` for errors | Interrupt other announcements (Android) |
| `accessibilityLabel` | `string` | the message text | What screen readers announce |

## Appearance

| Option | Type | Default | |
|---|---|---|---|
| `theme` | partial [theme tokens](./theme-tokens.md) | none | Token overrides for this toast |
| `glass` | `boolean` or `GlassConfig` | the Toaster's | `false` draws the opaque surface |
| `richColors` | `boolean` | `false` | Green or red surface and text for success and error toasts |
| `style` | `ViewStyle` | none | The toast surface, applied after tokens |
| `textStyle` | `TextStyle` | none | The message |
| `iconStyle` | `ViewStyle` | none | The icon's box |

`closeable` still works as a deprecated name for `closeButton`.
