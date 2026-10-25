---
title: Introduction
description: What expo-hot-toast is, what it draws on each platform, and when to use it.
group: Getting started
order: 1
---

expo-hot-toast shows toasts in Expo and React Native apps. You call
`toast.success('Saved')` from anywhere, and one `<Toaster />` near the root of
your app draws it.

```tsx
toast.success('Changes saved');
toast.error('Could not reach the server');
toast.promise(upload(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
});
```

## What it draws

| Platform | Surface |
|---|---|
| iOS 26 and later | Apple's Liquid Glass, through `expo-glass-effect` |
| iOS 26 with Reduce Transparency on | An opaque surface |
| iOS before 26 | An opaque surface |
| Android | An opaque surface, in light and dark |
| Web | Frosted glass: a backdrop blur under a translucent fill |

The opaque surface is designed for its platform: a solid fill, border and
shadow. It does not imitate glass. On the web, where browsers can blur what is
behind an element, toasts are frosted instead; anyone who prefers reduced
transparency gets the opaque surface there too.

## The API

The calls follow [react-hot-toast](https://react-hot-toast.com), the web
library: `toast`, `toast.success`, `toast.promise`, `<Toaster>`, `<ToastBar>`
and `useToaster` work as they do there. react-hot-toast itself renders DOM
elements, so it cannot run in a native app; this package rebuilds its API on
native views. If you know it from the web, read
[Coming from react-hot-toast](./coming-from-react-hot-toast.md) for the
differences.

Beyond that API, it adds what a phone needs:

- **A queue.** Three toasts show per position; the rest wait their turn.
- **Gestures.** Flick a toast away like a notification; press and hold to
  pause every timer.
- **A collapsed stack**, if you want one: older toasts tuck behind the newest
  and fan out when pressed.
- **Actions and a close button**, for Undo and for toasts people need to clear.
- **A description line and rich colours** for outcomes that need more.
- **Deduplication**, so twenty identical calls show one toast.
- **Accessibility**: screen reader announcements, Reduce Motion, Reduce
  Transparency, capped font scaling and a haptic for success and error.

## Next

- [Install it](./installation.md)
- [Show your first toast](./quick-start.md)
