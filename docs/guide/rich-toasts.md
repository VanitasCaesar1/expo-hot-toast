---
title: Rich toasts
description: Progress bars, steps, expandable details, Undo countdowns, notifications, banners, HUDs and the island.
group: Guides
order: 2.5
---

A toast can hold more than one line of text. Each kind below is one call, and
everything that moves (a filling bar, a draining ring) runs on the UI thread,
so it stays smooth while your JavaScript is busy.

## Info and warning

Two more outcome types, each with its own glyph and colour:

```tsx
toast.info('A new version is ready', { description: 'Restart the app to update.' });
toast.warning('Storage almost full', { description: '2% left on this device.' });
```

A warning plays the warning haptic; info plays none. With `richColors`, info is
blue and warning is amber.

## Progress

`toast.progress` shows a toast with a bar under its message and the percentage
at the end of the line, and returns a controller. Set the progress from 0 to 1,
then finish with a success or an error, which replaces the bar in the same
toast:

```tsx title="upload.ts"
const upload = toast.progress('Uploading 4 photos');

xhr.upload.onprogress = (e) => upload.set(e.loaded / e.total);
xhr.onload = () => upload.success('4 photos uploaded');
xhr.onerror = () => upload.error('Upload failed');
```

`set` writes straight to a shared value on the UI thread. Calling it on every
progress event re-renders nothing; the bar eases between values on its own.
Pass `'indeterminate'` while the length is unknown, and a sliver sweeps the
track instead.

For work that is already a promise, `toast.track` creates the toast, hands
your task a function to report progress with, and finishes the toast when the
promise settles:

```tsx
const file = await toast.track(
  (report) => download(url, { onProgress: report }),
  {
    loading: 'Downloading report',
    success: (file) => `Saved ${file.name}`,
    error: 'Download failed',
  },
);
```

`track` returns the task's own promise, so you still get the value or the
error.

### A ring instead of a bar

```tsx
toast.progress('Exporting video', { progressStyle: 'ring' });
```

The ring replaces the icon and fills clockwise from the top. The bar suits
toasts with a line or two of text; the ring suits short ones and the HUD.

## Steps

For work in named stages, `toast.steps` shows the current stage's name and a
bar split into one segment per stage, with "2/3" at the end of the line. The
stages already done are filled and the current one is tinted, since how far
through it the work is isn't known:

```tsx
const job = toast.steps(['Compressing video', 'Uploading', 'Processing']);

await compress();
job.next();
await upload();
job.next();
await process();
job.success('Video published');
```

`job.go(index)` jumps to a stage; `job.step` is the current one, from 0. A
screen reader hears each stage as "Uploading, step 2 of 3". Once the job has
an outcome, a late `next()` or `go()` does nothing, so the success toast is
never turned back into a stage.

## Expandable details

A chevron opens more content below the message. While it is open, the
Toaster's timers stop, so the details stay as long as someone is reading them:

```tsx
toast.error('3 photos failed to upload', {
  expandable: {
    content: 'IMG_2041.jpg, IMG_2042.jpg and IMG_2045.jpg are larger than 50 MB.',
  },
});
```

`content` can be any element. `defaultExpanded: true` opens it from the start,
and `label` changes what screen readers call the toggle (by default "Show
details" and "Hide details").

## Undo with a countdown

`countdown: true` on an action draws a ring around it that drains over the
time the toast has left, as Gmail's Undo does. It stops while the queue is
paused:

```tsx
toast('Conversation deleted', {
  duration: 6000,
  action: { label: 'Undo', countdown: true, onPress: restore },
});
```

## Cancel and confirm

`cancel` adds a quieter button before the action, for a question with two
answers:

```tsx
toast('Delete 3 photos?', {
  duration: 8000,
  cancel: { label: 'Cancel', onPress: () => {} },
  action: { label: 'Delete', color: '#FF3B30', onPress: deletePhotos },
});
```

Both buttons dismiss the toast after their `onPress`.

## Repeats

A toast with a `dedupeKey` shows once however often it is called. Each repeat
while it is on screen adds to a count on the toast, shown as ×2, ×3 and so on:

```tsx
toast.error('No connection', { dedupeKey: 'offline' });
```

## Shapes

`variant` changes a toast's shape. The calls below set it for you.

| Variant | Call | Where it goes | For |
|---|---|---|---|
| `pill` | `toast()` on iOS and the web | the Toaster's position | Short outcomes; the default with the glass preset |
| `snackbar` | `toast()` on Android | the Toaster's position, full width | The Material 3 default on Android |
| `card` | `toast.notify()` | the Toaster's position | Messages from people: a title, a body, a picture |
| `banner` | `toast.banner()` | edge to edge at the top, or the bottom for `bottom-*` positions | Lasting states: offline, maintenance |
| `hud` | `toast.hud()` | the middle of the screen | A large icon confirming one action |
| `island` | `toast.island()` | in the Dynamic Island, or just below the status bar | Short system-like events |

### Notification

```tsx
toast.notify({
  title: 'Maya Patel',
  body: 'Sent you 4 photos from the trip',
  avatar: { uri: maya.photoUrl },
  timestamp: 'now',
  onPress: () => router.push(`/chat/${maya.id}`),
});
```

`avatar` takes an image source or any element, and replaces the icon.
`onPress` makes the whole toast a button that dismisses after it runs.

### Banner

```tsx
toast.banner("You're offline", {
  type: 'warning',
  description: 'Changes will sync when you reconnect.',
  duration: 'infinite',
});
```

Banners default to `type: 'info'`. They span the screen and slide from the
edge rather than popping in.

### HUD

```tsx
toast.hud('Added to Library');                       // success by default
toast.hud('Saving', { type: 'loading' });
```

The HUD draws a large icon above the message and scales in where it is.

### Island

```tsx
toast.island('AirPods Pro connected', { type: 'success' });
```

A black capsule, in either appearance, as the island itself is always black.
On iPhones with a Dynamic Island it grows down out of the island and keeps its
content below the camera, as an expanded Live Activity does. Elsewhere it sits
just below the notch or status bar.

## Everything at once

These options combine. A toast can be a card with an avatar, a progress bar
and an action; a banner with a cancel button; a HUD with a ring. The example
app's "Rich toasts" section shows each kind above on iOS and Android.
