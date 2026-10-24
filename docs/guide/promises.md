---
title: Promises
description: One toast that follows a promise from loading to its outcome.
group: Guides
order: 2
---

`toast.promise` shows a loading toast, then turns that same toast into the
success or error toast when the promise settles.

```tsx
import { toast } from 'expo-hot-toast';

await toast.promise(uploadPhoto(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
});
```

## Messages from the result

`success` receives the resolved value and `error` receives the rejection
reason. Either can return a string or an element.

```tsx
await toast.promise(saveDraft(draft), {
  loading: 'Saving…',
  success: (saved) => `Saved “${saved.title}”`,
  error: (cause) => `Could not save: ${cause instanceof Error ? cause.message : 'unknown error'}`,
});
```

Leave out `success` or `error` and the toast is dismissed instead of showing an
outcome for that case.

## Options per stage

The third argument takes options for every stage, plus `loading`, `success`
and `error` buckets that apply to one stage each.

```tsx
toast.promise(
  sync(),
  { loading: 'Syncing…', success: 'Synced', error: 'Sync failed' },
  {
    position: 'bottom-center',          // all stages
    success: { duration: 'short' },     // only the success toast
    error: { closeButton: true },       // only the error toast
  },
);
```

## A function instead of a promise

Pass a function to have `toast.promise` start the work. If the function throws
before returning a promise, that counts as a rejection.

```tsx
toast.promise(() => api.delete(item.id), {
  loading: 'Deleting…',
  success: 'Deleted',
  error: 'Could not delete',
});
```

## Return value

`toast.promise` returns the original promise, not a copy that swallows errors.
`await` resolves with the value, or throws the rejection, as it would without
the toast.

```tsx
try {
  const saved = await toast.promise(save(draft), messages);
  navigate('Draft', { id: saved.id });
} catch {
  // the error toast is already showing
}
```
