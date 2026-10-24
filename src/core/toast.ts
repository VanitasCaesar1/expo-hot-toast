import { genId } from './ids';
import {
  ActionType,
  DEFAULT_DEDUPE_WINDOW,
  DEFAULT_TOASTER_ID,
  dispatch,
  dispatchAll,
  findDedupeHit,
  findToasterIdFor,
  getState,
  recordDedupe,
  resolveValue,
} from './store';
import type {
  DefaultToastOptions,
  DismissReason,
  Renderable,
  Toast,
  ToastOptions,
  ToastPosition,
  ToastType,
} from './types';

type Message = Renderable | ((toast: Toast) => Renderable);

export interface PromiseMessages<T> {
  loading: Renderable;
  success?: Renderable | ((value: T) => Renderable);
  error?: Renderable | ((error: unknown) => Renderable);
}

export interface ToastHandler {
  (message: Message, options?: ToastOptions): string;
}

export interface ToastAPI {
  (message: Message, options?: ToastOptions): string;
  error: ToastHandler;
  success: ToastHandler;
  loading: ToastHandler;
  custom: ToastHandler;
  promise<T>(
    promise: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<T>,
    options?: DefaultToastOptions,
  ): Promise<T>;
  /**
   * Mark dismissed so the exit animation plays. Unmount happens afterwards,
   * once the exit has had time to finish.
   *
   * `reason` is reported through `ToastOptions.onDismiss`, so callers can tell a
   * timeout from a swipe from an overflow eviction.
   */
  dismiss(toastId?: string, toasterId?: string, reason?: DismissReason): void;
  dismissAll(toasterId?: string, reason?: DismissReason): void;
  /** Remove instantly, with no exit animation. */
  remove(toastId?: string, toasterId?: string): void;
  removeAll(toasterId?: string): void;
}

function createToast(
  message: Message,
  type: ToastType,
  opts?: ToastOptions,
): Toast {
  // Generated once. rht's createToast carries the id through the spread and
  // then re-assigns it, so an explicit id is honoured but the spread value is
  // dead. Computing it up front keeps the object literal honest.
  const id = opts?.id ?? genId();
  const requestedDuration = opts?.duration;

  return {
    ...opts,
    type,
    id,
    // Updating a toast by id without naming a region lands in the region that
    // already holds it, as in react-hot-toast. Defaulting to 'default' here
    // would stack a second copy there and leave the original untouched.
    toasterId:
      opts?.toasterId ??
      (opts?.id === undefined ? undefined : findToasterIdFor(opts.id)) ??
      DEFAULT_TOASTER_ID,
    message,
    // A numeric duration travels as-is; only a symbolic one needs the preset
    // field. Dropping the number here would silently fall back to the per-type
    // default, so `toast('x', { duration: 1000 })` would live 4000ms.
    durationPreset:
      typeof requestedDuration === 'string' ? requestedDuration : undefined,
    duration:
      typeof requestedDuration === 'number' ? requestedDuration : undefined,
    resolvedPosition: (opts?.position ?? 'top-center') as ToastPosition,
    depth: 0,
    pauseDuration: 0,
    createdAt: Date.now(),
    visible: true,
    dismissed: false,
    // Cleared explicitly: an update by id revives a dismissed toast, and the
    // reason it was dismissed the first time no longer applies.
    dismissReason: undefined,
  };
}

const toasterIdFor = (toast: Toast): string =>
  toast.toasterId ?? DEFAULT_TOASTER_ID;

/**
 * Deduplication.
 *
 * A toast whose `dedupeKey` is already on screen inside its window returns that
 * toast's id instead of stacking a copy. The caller can then update it in place
 * by passing that id back.
 *
 * This is the fix for a spinner that fires twenty times a second: twenty stacked
 * toasts tell the user nothing, whereas one toast that updates in place tells
 * them exactly what is happening.
 */
function dedupe(opts: ToastOptions | undefined): string | null {
  if (opts?.dedupeKey === undefined) return null;

  const toasterId = opts.toasterId ?? DEFAULT_TOASTER_ID;
  const hit = findDedupeHit(
    toasterId,
    opts.dedupeKey,
    opts.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW,
  );
  // Only a toast that is still on screen can absorb a duplicate. Returning the
  // id of one that was already dismissed or removed would swallow the new
  // message: the caller gets an id, and nothing is shown.
  if (hit === null) return null;
  const live = getState(toasterId).toasts.some((t) => t.id === hit && !t.dismissed);
  return live ? hit : null;
}

const createHandler =
  (type: ToastType = 'blank'): ToastHandler =>
  (message, options) => {
    const existing = dedupe(options);
    if (existing) return existing;

    const toast = createToast(message, type, options);
    dispatch({ type: ActionType.UPSERT_TOAST, toast }, toasterIdFor(toast));

    if (options?.dedupeKey !== undefined) {
      recordDedupe(toasterIdFor(toast), options.dedupeKey, toast.id);
    }

    return toast.id;
  };

function createToastAPI(): ToastAPI {
  const api = ((message: Message, options?: ToastOptions) =>
    createHandler('blank')(message, options)) as ToastAPI;

  api.error = createHandler('error');
  api.success = createHandler('success');
  api.loading = createHandler('loading');
  api.custom = createHandler('custom');

  api.dismiss = (toastId?: string, toasterId?: string, reason?: DismissReason) => {
    const action = {
      type: ActionType.DISMISS_TOAST,
      toastId,
      reason,
    } as const;
    // Name a region and only that region is touched. Otherwise fan out across
    // every Toaster that currently holds state.
    if (toasterId) dispatch(action, toasterId);
    else dispatchAll(action);
  };

  api.dismissAll = (toasterId?: string, reason?: DismissReason) =>
    api.dismiss(undefined, toasterId, reason);

  api.remove = (toastId?: string, toasterId?: string) => {
    const action = { type: ActionType.REMOVE_TOAST, toastId } as const;
    if (toasterId) dispatch(action, toasterId);
    else dispatchAll(action);
  };

  api.removeAll = (toasterId?: string) => api.remove(undefined, toasterId);

  api.promise = <T,>(
    promise: Promise<T> | (() => Promise<T>),
    messages: PromiseMessages<T>,
    opts?: DefaultToastOptions,
  ): Promise<T> => {
    const {
      loading: loadingOpts,
      success: successOpts,
      error: errorOpts,
      ...shared
    } = opts ?? {};

    const id = api.loading(messages.loading, { ...shared, ...loadingOpts });

    // A thunk is invoked after the loading toast is dispatched, so a synchronous
    // throw would escape the call — contradicting the declared `Promise<T>`
    // return, so a caller using `.catch()` gets an uncaught exception instead —
    // and would strand a `loading` toast that never auto-dismisses. Turning a
    // synchronous throw into a rejection keeps both promises intact.
    let settled: Promise<T>;
    try {
      settled = typeof promise === 'function' ? promise() : promise;
    } catch (cause) {
      settled = Promise.reject(cause);
    }

    settled
      .then((value) => {
        const resolver = messages.success;
        const message = resolver ? resolveValue(resolver, value) : undefined;
        if (message) {
          // rht spreads `{ id, ...opts, ...opts.success }` — `id` FIRST. That
          // lets `toastOptions.success.id` override the id, which strands the
          // loading toast forever: it is never updated and never dismissed.
          // Spreading the per-type bag first and forcing `id` last removes the
          // only way to orphan it.
          api.success(message, { ...shared, ...successOpts, id });
        } else {
          api.dismiss(id);
        }
        return value;
      })
      .catch((cause: unknown) => {
        // A throw from a resolver lands here too. Reporting it as the promise's
        // failure is correct: the toast chain and the caller's await should
        // agree about what went wrong.
        const resolver = messages.error;
        const message = resolver ? resolveValue(resolver, cause) : undefined;
        if (message) {
          api.error(message, { ...shared, ...errorOpts, id });
        } else {
          api.dismiss(id);
        }
      });

    // Return the original promise, not the catch-swallowing chain, so
    // `await toast.promise(...)` still rejects for the caller.
    return settled;
  };

  return api;
}

export const toast = createToastAPI();
export default toast;