---
title: Quick start
description: Show a toast, update it in place, and follow a promise.
group: Getting started
order: 3
---

This assumes `<Toaster />` is mounted at the root, as in
[Installation](./installation.md).

## Show a toast

Import `toast` anywhere: a component, a hook, a data layer. It does not need a
React context.

```tsx
import { Button } from 'react-native';
import { toast } from 'expo-hot-toast';

export function SaveButton() {
  return <Button title="Save" onPress={() => toast.success('Changes saved')} />;
}
```

## Update it in place

Every call returns the toast's id. Pass it back to change the toast instead of
adding another.

```tsx
const id = toast.loading('Syncing…');
// later
toast.success('Synced', { id });
```

## Follow a promise

`toast.promise` does that for you: a loading toast that becomes the success or
error toast when the promise settles.

```tsx
await toast.promise(saveDraft(draft), {
  loading: 'Saving…',
  success: 'Draft saved',
  error: 'Could not save the draft',
});
```

It returns the original promise, so `await` still throws if the save fails.

## Add an Undo

```tsx
toast('Message archived', {
  action: { label: 'Undo', onPress: () => restore(message) },
});
```

## Where next

- [Toast types](./toast-types.md): every kind of toast, and dismissing them.
- [Positions](./positions.md): the bottom of the screen, several Toasters,
  toasts above modals.
- [Theming](./theming.md): colours, radius, motion.
