---
title: Actions and dismissing
description: Undo buttons, the close button, tap and swipe to dismiss.
group: Guides
order: 3
---

## An action button

`action` adds a trailing button. When it is pressed, its handler runs first,
then the toast is dismissed with reason `'action'`.

```tsx
toast('Message archived', {
  action: { label: 'Undo', onPress: () => restore(message) },
});
```

Give it its own colour with `color`; otherwise it uses the theme's
`actionColor`.

```tsx
action: { label: 'Retry', onPress: retry, color: '#FF9F0A' }
```

## A close button

`closeButton: true` adds a small × at the end of the toast. Use it on toasts
that stay up for a long time, or that people may want to clear early.

```tsx
toast('Export started. This can take a minute.', {
  duration: 'infinite',
  closeButton: true,
});
```

`closeButtonColor` tints the ×.

## Tap to dismiss

Tapping a toast dismisses it on Android, and does nothing on iOS, where toasts
are not usually tappable. Set `dismissOnTap` to choose for yourself:

```tsx
<Toaster toastOptions={{ dismissOnTap: true }} />
```

## Swipe to dismiss

Flick a toast toward its edge, the way you dismiss a notification: up for a
toast at the top of the screen, down for one at the bottom. About two thirds of
its height is enough, or a quick flick.

Or drag it to the right (left in right-to-left layouts), past 72 px, or fling
it that way. Dragging away from the edge, or the other way sideways, resists,
so a toast you push the wrong way springs back. Each drag follows the direction
it starts in.

A Material snackbar, the default on Android, is swiped sideways in either
direction instead, as Material 3 has it. `swipeDirections` picks the
directions for any toast:

```tsx
toast('Message archived', { swipeDirections: ['left', 'right', 'down'] });
```

Change the sideways distance, or turn swiping off, on the Toaster:

```tsx
<Toaster panThreshold={120} />   // farther
<Toaster panThreshold={0} />     // no swiping
```

## Press and hold to read

Pressing a toast pauses every timer in its Toaster until you let go, so a long
message does not vanish while someone is reading it. Paused time is added back
to each toast's deadline.

To pause from code, for example while a modal is open:

```tsx
<Toaster paused={modalOpen} />
```
