---
title: Timing and the queue
description: Durations, the visible limit, what happens to extra toasts, and deduplication.
group: Guides
order: 5
---

## Durations

| Type | Default |
|---|---|
| `toast()`, `toast.error()`, `toast.custom()` | 4000 ms |
| `toast.success()` | 2000 ms |
| `toast.loading()` | until it is updated or dismissed |

Set `duration` to a number of milliseconds, or to a preset:

```tsx
toast('Copied', { duration: 'short' });          // 2000 ms
toast('Link expires in 24 hours', { duration: 'long' });  // 4500 ms
toast('Reconnecting…', { duration: 'infinite' }); // until dismissed
toast('Saved', { duration: 3000 });
```

Change the defaults for a whole Toaster, for every type or one type at a time:

```tsx
<Toaster
  toastOptions={{
    duration: 5000,                 // every toast in this Toaster
    success: { duration: 'short' }, // except success toasts
  }}
/>
```

A toast's own options always win over the Toaster's.

### When the clock starts

A toast's time counts from when it appears on screen, not from when you called
`toast()`. A toast that waited in the queue gets its full duration once it
shows.

Time spent paused (pressing and holding a toast, or `<Toaster paused>`) is
added back. In a stack, each toast further from the edge is given a little
longer, so a stack clears one toast at a time rather than all on one frame.

## The visible limit

Three toasts show per position, newest at the front. A newer toast pushes the
oldest one showing back into the queue: it plays its exit, waits with its timer
paused, and comes back, with its full time, when space frees. A dismissed toast
gives up its place as soon as it starts to leave, so the next one moves up
while it plays its exit.

```tsx
<Toaster visibleToasts={5} />
```

## When the queue is full

Up to `maxPending` toasts (10 by default) wait beyond the visible ones. Past
that, one is dropped: it plays its exit and reports the reason `'overflow'` to
its `onDismiss`. `dropPolicy` picks which one: `'oldest'`, the default, drops
the toast that has waited longest; `'newest'` drops the latest arrival.

```tsx
<Toaster
  maxPending={10}
  dropPolicy="oldest" // or 'newest'
/>
```

## Deduplication

Give toasts a `dedupeKey`. A call whose key matches a toast already on screen,
within `dedupeWindowMs` (1000 ms by default), returns that toast's id instead
of adding a second one.

```tsx
function onSaveError() {
  toast.error('Could not save', { dedupeKey: 'save-error' });
}
```

Call that from a retry loop and one toast shows, not twenty. Because the call
returns the existing id, you can also update the toast you already have:

```tsx
const id = toast('Saving draft…', { dedupeKey: 'draft', dedupeWindowMs: 3000 });
toast.success('Draft saved', { id });
```

A key whose toast has already been dismissed starts a new toast.

## After a toast is dismissed

A dismissed toast stays mounted for its exit animation, then is removed.
`removeDelay` changes how long that is; the default is the exit duration
(400 ms). A shorter value cuts the exit short.
