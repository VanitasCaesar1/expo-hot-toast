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

Drag a toast to the right, past 72 px, to dismiss it. A fast fling in either
direction also dismisses. Dragging left resists, so a toast you push the wrong
way springs back.

Change the distance, or turn swiping off, on the Toaster:

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
