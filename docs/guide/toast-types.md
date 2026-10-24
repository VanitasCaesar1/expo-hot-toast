---
title: Toast types
description: Plain, success, error, loading and custom toasts; icons; updating and dismissing.
group: Guides
order: 1
---

## The five calls

```tsx
import { toast } from 'expo-hot-toast';

toast('Message archived');                 // plain, no icon
toast.success('Changes saved');            // green check
toast.error('Could not reach the server'); // red mark
toast.loading('Syncing…');                 // spinner, stays until changed
toast.custom(<OfflineBanner />);           // your element, drawn as-is
```

Each returns the toast's id, a string.

| Call | Icon | Default duration | Haptic |
|---|---|---|---|
| `toast()` | none | 4 s | none |
| `toast.success()` | check, drawn in | 2 s | light |
| `toast.error()` | circle with a mark | 4 s | firm |
| `toast.loading()` | spinner | until updated or dismissed | none |
| `toast.custom()` | none | 4 s | none |

The message can be a string, any element, or a function that receives the
toast and returns either.

## A description

`description` adds a second, quieter line under the message, for detail the
message does not need. Screen readers hear it after the message.

```tsx
toast.error('Could not upload photo', {
  description: 'Check your connection and try again.',
});
```

## Custom toasts

`toast.custom` draws your element with no surface, icon or padding, but it
still enters and leaves with the same motion and sits in the same queue.

```tsx
toast.custom(
  <View style={styles.banner}>
    <Text>You are offline</Text>
  </View>,
  { duration: 'infinite' },
);
```

To keep the built-in surface and change only what is inside it, use
[custom rendering](./custom-rendering.md) instead.

## Icons

```tsx
toast.success('Saved', { icon: '💾' });                   // any element
toast('Saved', { icon: null });                           // none
toast.success('Saved', { iconTheme: { primary: '#30D158', secondary: '#fff' } });
```

`iconTheme.primary` colours the built-in glyph and the spinner.
`iconTheme.secondary` is accepted for react-hot-toast compatibility; the
built-in glyphs are single strokes and do not use it.

## Update a toast in place

Pass an existing id to replace that toast's type, message and options. It
stays where it is, and its icon pops in again if the type changed.

```tsx
const id = toast.loading('Uploading…');
toast.success('Uploaded', { id });
```

[`toast.promise`](./promises.md) does this for you.

## Dismiss and remove

```tsx
toast.dismiss(id);   // play the exit, then remove
toast.dismiss();     // dismiss every toast
toast.dismissAll();  // the same
toast.remove(id);    // remove at once, with no exit
toast.removeAll();
```

Users can also swipe a toast away, tap it (on by default on Android), or use
an [action or close button](./actions.md). To know which happened, pass
`onDismiss`:

```tsx
toast('Draft saved', {
  onDismiss: (id, reason) => analytics.track('toast_dismissed', { reason }),
});
```

`reason` is one of `'timeout'`, `'swipe'`, `'tap'`, `'close'`, `'action'`,
`'overflow'` or `'programmatic'`. The first reason wins: a toast that timed out
and was then swiped reports `'timeout'`.
