import { render, screen, act } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Toaster } from '../src/components/toaster';
import { __resetIdCounter } from '../src/core/ids';
import { __resetStore, getState } from '../src/core/store';
import { toast } from '../src/core/toast';
import type { Toast } from '../src/core/types';

/**
 * `toast.promise` exercised through a mounted Toaster rather than against the
 * store. The store-level contract is one dispatch call; what has to hold is the
 * thing a user sees — one toast that changes in place, never two, never a
 * stranded loading row underneath a result.
 */
beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  jest.clearAllMocks();
});

describe('toast.promise — through a mounted Toaster', () => {
  it('shows the loading toast, then the success toast, as one toast throughout', async () => {
    const deferred = deferredPromise<string>();
    render(<Toaster />);

    let settled!: Promise<string>;
    await act(async () => {
      settled = toast.promise(deferred.promise, {
        loading: 'saving',
        success: (value) => `saved ${value}`,
      });
    });

    expect(screen.getByText('saving')).toBeTruthy();
    const loading = only(getState().toasts);
    expect(loading.type).toBe('loading');
    expect(loading.visible).toBe(true);

    await act(async () => {
      deferred.resolve('receipt');
      await settled;
    });

    expect(screen.queryByText('saving')).toBeNull();
    expect(screen.getByText('saved receipt')).toBeTruthy();

    const resolved = only(getState().toasts);
    expect(resolved.type).toBe('success');
    // Same id, so the loading row was updated in place rather than replaced.
    expect(resolved.id).toBe(loading.id);
    expect(resolved.visible).toBe(true);
  });

  it('shows an error toast carrying the rejection reason', async () => {
    const reason = new Error('network unreachable');
    const deferred = deferredPromise<string>();
    const onError = jest.fn((error: unknown) => `failed: ${(error as Error).message}`);

    render(<Toaster />);

    let settled!: Promise<string>;
    await act(async () => {
      settled = toast.promise(deferred.promise, { loading: 'contacting server', error: onError });
    });
    expect(screen.getByText('contacting server')).toBeTruthy();

    await act(async () => {
      deferred.reject(reason);
      // The caller still sees the rejection. The internal chain swallows it for
      // the toast's benefit, not for the promise that was handed back.
      await expect(settled).rejects.toBe(reason);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toBe(reason);
    expect(screen.queryByText('contacting server')).toBeNull();
    expect(screen.getByText('failed: network unreachable')).toBeTruthy();
    expect(only(getState().toasts).type).toBe('error');
  });

  it('does not let toastOptions.success.id hijack the promise id', async () => {
    // react-hot-toast spreads `{ id, ...opts, ...opts.success }` with `id`
    // first, so a per-type id overrides it and strands the loading toast
    // forever: never updated, never dismissed.
    const deferred = deferredPromise<string>();
    render(<Toaster />);

    let settled!: Promise<string>;
    await act(async () => {
      settled = toast.promise(
        deferred.promise,
        { loading: 'uploading', success: 'uploaded' },
        { success: { id: 'hijacked' } },
      );
    });
    const loading = only(getState().toasts);

    await act(async () => {
      deferred.resolve('file.png');
      await settled;
    });

    const resolved = only(getState().toasts);
    expect(resolved.id).toBe(loading.id);
    expect(resolved.id).not.toBe('hijacked');
    expect(getState().toasts.filter((t) => t.id === 'hijacked')).toEqual([]);
    expect(screen.getByText('uploaded')).toBeTruthy();
    // The loading row is gone from the screen, not just overwritten in place.
    expect(screen.queryByText('uploading')).toBeNull();
  });

  it('dismisses the toast when the promise resolves with no success message', async () => {
    const deferred = deferredPromise<string>();
    render(<Toaster />);

    let settled!: Promise<string>;
    await act(async () => {
      settled = toast.promise(deferred.promise, { loading: 'syncing' });
    });
    const loading = only(getState().toasts);

    await act(async () => {
      deferred.resolve('done');
      await settled;
    });

    // Read from the store rather than the screen: a dismissal only marks the
    // toast dismissed, and unlinking it is Reanimated's exit animation's job —
    // which the test renderer stubs out.
    const after = only(getState().toasts);
    expect(after.id).toBe(loading.id);
    expect(after.visible).toBe(false);
    expect(after.dismissed).toBe(true);
    // Nothing took the placeholder's place.
    expect(after.type).toBe('loading');
  });

  it('dismisses the toast when it rejects with no error message', async () => {
    const deferred = deferredPromise<string>();
    render(<Toaster />);

    let settled!: Promise<string>;
    await act(async () => {
      settled = toast.promise(deferred.promise, { loading: 'syncing' });
    });

    await act(async () => {
      deferred.reject(new Error('boom'));
      await expect(settled).rejects.toThrow('boom');
    });

    const after = only(getState().toasts);
    expect(after.visible).toBe(false);
    expect(after.dismissed).toBe(true);
    // An unlabelled failure must not be dressed up as a success.
    expect(after.type).toBe('loading');
  });

  it('accepts a thunk and invokes it once', async () => {
    const deferred = deferredPromise<number>();
    const factory = jest.fn(() => deferred.promise);
    render(<Toaster />);

    let settled!: Promise<number>;
    await act(async () => {
      settled = toast.promise(factory, {
        loading: 'counting',
        success: (count) => `${count} items`,
      });
    });

    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByText('counting')).toBeTruthy();

    await act(async () => {
      deferred.resolve(3);
      await settled;
    });

    expect(screen.getByText('3 items')).toBeTruthy();
    expect(only(getState().toasts).type).toBe('success');
  });

  it('resolves the success message against the value the promise settled with', async () => {
    const deferred = deferredPromise<{ id: string }>();
    const onSuccess = jest.fn((value: { id: string }) => `created ${value.id}`);
    render(<Toaster />);

    let settled!: Promise<{ id: string }>;
    await act(async () => {
      settled = toast.promise(deferred.promise, { loading: 'creating', success: onSuccess });
    });

    // Not called on the loading frame — the resolver only sees a settled value.
    expect(onSuccess).not.toHaveBeenCalled();

    const resolvedValue = { id: 'abc' };
    await act(async () => {
      deferred.resolve(resolvedValue);
      await settled;
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Identity, not shape: the same object the caller awaited.
    expect(onSuccess.mock.calls[0]![0]).toBe(resolvedValue);
    expect(screen.getByText('created abc')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * A promise the test settles by hand, so the loading frame and the settled
 * frame are two separate assertions rather than one racing `await`.
 */
function deferredPromise<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Narrow the default region to a single toast, failing loudly otherwise. */
function only(toasts: Toast[]): Toast {
  expect(toasts).toHaveLength(1);
  return toasts[0]!;
}

describe('toast.promise — a thunk that throws synchronously', () => {
  it('converts the throw into a rejection instead of escaping the call', async () => {
    // The declared return type is Promise<T>, so a synchronous throw used to
    // bypass a caller's .catch() entirely while leaving a `loading` toast
    // behind — one that resolves to duration Infinity and never dismisses.
    const thunk = () => {
      throw new Error('sync boom');
    };

    const result = toast.promise(thunk, {
      loading: 'never seen',
      error: (e) => `caught: ${(e as Error).message}`,
    });

    await expect(result).rejects.toThrow('sync boom');
    await act(async () => {});

    const state = getState();
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]!.type).toBe('error');
    expect(state.toasts[0]!.visible).toBe(true);
  });

  it('never leaves a loading toast stranded', async () => {
    const thunk = () => {
      throw new Error('boom');
    };

    await expect(
      toast.promise(thunk, { loading: 'stranded?', error: 'failed' }),
    ).rejects.toThrow();

    await act(async () => {});

    const state = getState();
    expect(state.toasts.every((t) => t.type !== 'loading')).toBe(true);
  });
});
