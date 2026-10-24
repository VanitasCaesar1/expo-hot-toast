---
title: Coming from react-hot-toast
description: What carries over from the web library, and what is different.
group: More
order: 1
---

react-hot-toast renders DOM elements, so it runs only on the web; it cannot
render in a native app. This package rebuilds its API on native views, so toast
code written for a React web app ports by changing the import:

```diff
- import toast, { Toaster } from 'react-hot-toast';
+ import toast, { Toaster } from 'expo-hot-toast';
```

## The same

`toast`, `toast.success`, `toast.error`, `toast.loading`, `toast.custom`,
`toast.promise`, `toast.dismiss`, `toast.remove`, `<Toaster>` with
`position`, `toastOptions` (including per-type buckets) and `reverseOrder`,
`<ToastBar>` inside the Toaster's render function, `iconTheme`, `removeDelay`,
`resolveValue` and `useToaster`.

## Different

| react-hot-toast | expo-hot-toast |
|---|---|
| `className` | No CSS here: use `style`, `textStyle` and `theme` |
| `ariaProps` | `accessibilityLabel` and `important` |
| Up to 20 toasts on screen | 3 per position (`visibleToasts`); the rest queue instead of being dropped |
| `gutter` | `gap` (`gutter` still works) |
| `toastLimit` | `visibleToasts` (`toastLimit` still works) |
| `useToaster(toastOptions, toasterId)` | `useToaster({ toastOptions, toasterId })` |
| `calculateOffset`, `updateHeight` | Not needed: layout places toasts |
| `iconTheme.secondary` fills the icon's mark | Accepted, unused: the built-in glyphs are single strokes |

## New

Things react-hot-toast does not have:

- [`action`](./actions.md) buttons and a [`closeButton`](./actions.md#a-close-button)
- [Swipe to dismiss](./actions.md#swipe-to-dismiss), and press and hold to pause
- [`dedupeKey`](./timing-and-queue.md#deduplication)
- [`onDismiss`](./toast-types.md#dismiss-and-remove) with a reason
- Duration presets: `'short'`, `'long'`, `'infinite'`
- A [queue](./timing-and-queue.md#the-visible-limit) with `maxPending` and `dropPolicy`
- Liquid Glass on iOS 26, and [screen reader, Reduce Motion and text size support](./accessibility.md)
