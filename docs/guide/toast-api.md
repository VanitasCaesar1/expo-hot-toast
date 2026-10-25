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
toast.info(message, options?): string
toast.warning(message, options?): string
toast.loading(message, options?): string
toast.custom(element, options?): string
```

| Parameter | Type |
|---|---|
| `message` | `ReactNode`, or `(toast: Toast) => ReactNode` |
| `options` | [`ToastOptions`](./toast-options.md) |

Returns the toast's id. With an `id` in `options`, replaces that toast instead.
With a `dedupeKey` that matches a toast on screen, returns that toast's id,
adds nothing, and counts the repeat on the toast (it shows `×2`, `×3`, …).

## toast.update

```ts
toast.update(id: string, changes: Partial<ToastOptions> & { message?, type? }): void
```

Changes some fields of a toast that is showing and keeps the rest, its place
in the queue and its timer. A `duration` in `changes` restarts the timer with
the new length. Unlike `toast(…, { id })`, nothing is replaced.

## Shapes

```ts
toast.hud(message, options?: ToastOptions & { type? }): string      // default type 'success'
toast.banner(message, options?: ToastOptions & { type? }): string   // default type 'info'
toast.island(message, options?: ToastOptions & { type? }): string   // default type 'blank'
toast.notify({ title, body?, type?, ...options }): string
```

Each sets `variant` for you. See [Rich toasts](./rich-toasts.md#shapes).

## Progress

```ts
toast.progress(message, options?): ProgressController
toast.steps(labels: string[], options?): StepsController
toast.track<T>(
  task: (report: (progress: number) => void) => Promise<T>,
  messages: { loading; success?; error? },
  options?,
): Promise<T>

interface ProgressController {
  id: string;
  set(progress: number | 'indeterminate'): void; // 0 to 1, on the UI thread
  update(changes): void;
  success(message, options?): void;
  error(message, options?): void;
  dismiss(): void;
}

interface StepsController extends Omit<ProgressController, 'set'> {
  step: number;
  next(): void;
  go(index: number): void;
}
```

`set` writes the value to the UI thread directly, so calling it many times a
second never re-renders the toast. See [Rich toasts](./rich-toasts.md#progress).

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

type ToastType = 'blank' | 'success' | 'error' | 'info' | 'warning' | 'loading' | 'custom';

type ToastVariant = 'auto' | 'pill' | 'snackbar' | 'card' | 'banner' | 'hud' | 'island';

type SwipeDirection = 'left' | 'right' | 'up' | 'down';

type ToastHaptic =
  | 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error' | false;

type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
```
