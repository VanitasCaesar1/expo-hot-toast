---
title: toast()
description: Every function on the toast object, with its signature.
group: Reference
order: 1
---

```ts
import { toast } from 'expo-hot-toast';
// or: import toast from 'expo-hot-toast';
```

## Creating toasts

```ts
toast(message, options?): string
toast.success(message, options?): string
toast.error(message, options?): string
toast.loading(message, options?): string
toast.custom(element, options?): string
```

| Parameter | Type |
|---|---|
| `message` | `ReactNode`, or `(toast: Toast) => ReactNode` |
| `options` | [`ToastOptions`](./toast-options.md) |

Returns the toast's id. With an `id` in `options`, updates that toast instead.
With a `dedupeKey` that matches a toast on screen, returns that toast's id and
adds nothing.

## toast.promise

```ts
toast.promise<T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: {
    loading: ReactNode;
    success?: ReactNode | ((value: T) => ReactNode);
    error?: ReactNode | ((error: unknown) => ReactNode);
  },
  options?: ToastOptions & { loading?: ToastOptions; success?: ToastOptions; error?: ToastOptions },
): Promise<T>
```

Returns the original promise. See [Promises](./promises.md).

## Dismissing and removing

```ts
toast.dismiss(toastId?: string, toasterId?: string, reason?: DismissReason): void
toast.dismissAll(toasterId?: string, reason?: DismissReason): void
toast.remove(toastId?: string, toasterId?: string): void
toast.removeAll(toasterId?: string): void
```

`dismiss` plays the exit animation, then removes the toast. `remove` takes it
off screen at once. Without a `toastId` they apply to every toast; without a
`toasterId`, to every Toaster.

`reason` is passed to the toast's `onDismiss`. It defaults to
`'programmatic'`.

## Types

```ts
type DismissReason =
  | 'timeout' | 'swipe' | 'tap' | 'close' | 'action' | 'overflow' | 'programmatic';

type ToastType = 'blank' | 'success' | 'error' | 'loading' | 'custom';

type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
```
