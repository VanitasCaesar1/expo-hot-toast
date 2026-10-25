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
import { resolveDuration } from './defaults';
import { applyOwnProgress, setProgress } from './progress';
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

/** What `toast.update` can change. */
export type ToastUpdate = Partial<Omit<ToastOptions, 'id' | 'toasterId'>> & {
  message?: Message;
  type?: ToastType;
};

/** Drives a progress toast. Returned by `toast.progress()`. */
export interface ProgressController {
  readonly id: string;
  /**
   * Set the progress, from 0 to 1, or `'indeterminate'`. Written straight to
   * the UI thread: call it as often as you like, the toast does not re-render.
   */
  set(progress: number | 'indeterminate'): void;
  /** Change the message, description or any other field. */
  update(changes: ToastUpdate): void;
  /** Finish: the same toast becomes a success toast. */
  success(message: Message, options?: ToastOptions): void;
  /** Fail: the same toast becomes an error toast. */
  error(message: Message, options?: ToastOptions): void;
  dismiss(): void;
}

/** Drives a step-by-step toast. Returned by `toast.steps()`. */
export interface StepsController extends Omit<ProgressController, 'set'> {
  /** The current step, from 0. */
  readonly step: number;
  /** Move to the next step: its label, and one more segment filled. */
  next(): void;
  /** Move to step `index`, from 0. */
  go(index: number): void;
}

export interface TrackMessages<T> {
  loading: Renderable;
  success?: Renderable | ((value: T) => Renderable);
  error?: Renderable | ((error: unknown) => Renderable);
}

/** The shape-specific calls take a type, which sets the icon, and options. */
export type ShapedOptions = ToastOptions & { type?: Exclude<ToastType, 'custom'> };

/** A notification-style toast, as `toast.notify()` takes it. */
export interface NotifyOptions extends Omit<ToastOptions, 'description'> {
  title: Renderable;
  body?: Renderable;
  type?: Exclude<ToastType, 'custom'>;
}

export interface ToastAPI {
  (message: Message, options?: ToastOptions): string;
  error: ToastHandler;
  success: ToastHandler;
  loading: ToastHandler;
  info: ToastHandler;
  warning: ToastHandler;
  custom: ToastHandler;
  /**
   * Change some of a showing toast's fields, keeping the rest and its place in
   * the queue: `toast.update(id, { message: 'Almost there' })`. Unlike calling
   * `toast(…, { id })`, which replaces the toast, this keeps its timer too,
   * unless `duration` is part of the update.
   */
  update(id: string, changes: ToastUpdate): void;
  /**
   * A toast with a progress bar, for uploads, downloads and long work:
   * `const upload = toast.progress('Uploading photo')`, then `upload.set(0.4)`
   * as it goes, and `upload.success('Photo uploaded')` at the end.
   */
  progress(message: Message, options?: ToastOptions): ProgressController;
  /**
   * A toast that walks through named steps, with a segmented bar:
   * `const job = toast.steps(['Compressing', 'Uploading', 'Processing'])`,
   * `job.next()` after each, `job.success('Done')` at the end.
   */
  steps(labels: string[], options?: ToastOptions): StepsController;
  /**
   * Runs `task` with a progress toast. `task` receives a function to report
   * progress with, and the toast follows its promise to success or error.
   */
  track<T>(task: (report: (progress: number) => void) => Promise<T>, messages: TrackMessages<T>, options?: ToastOptions): Promise<T>;
  /** A large confirmation in the middle of the screen, icon above text. Default type success. */
  hud(message: Message, options?: ShapedOptions): string;
  /** A full-width bar against the top (or bottom) edge, for states like being offline. Default type info. */
  banner(message: Message, options?: ShapedOptions): string;
  /** A notification: title, body, avatar and time, which `onPress` can open. */
  notify(options: NotifyOptions): string;
  /** A black capsule growing out of the Dynamic Island, for short or ongoing news. */
  island(message: Message, options?: ShapedOptions): string;
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
  // An explicit id is an update to that toast, not a new one to suppress.
  // Without this, `toast.promise` with a `dedupeKey` deduped its own success
  // update against the loading toast and spun forever.
  if (opts?.dedupeKey === undefined || opts.id !== undefined) return null;

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
  const live = getState(toasterId).toasts.find((t) => t.id === hit && !t.dismissed);
  if (!live) return null;
  // The repeat is counted on the toast already showing, which draws the count.
  dispatch(
    { type: ActionType.UPDATE_TOAST, toast: { id: hit, count: (live.count ?? 1) + 1 } },
    toasterId,
  );
  return hit;
}

const createHandler =
  (type: ToastType = 'blank'): ToastHandler =>
  (message, options) => {
    const existing = dedupe(options);
    if (existing) return existing;

    const toast = createToast(message, type, options);
    // Written now, before the toast mounts, so a `set()` straight after
    // `toast.progress()` is not overwritten when it does.
    if (options?.progress !== undefined) applyOwnProgress(toast.id, options.progress);
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
  api.info = createHandler('info');
  api.warning = createHandler('warning');
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

  api.update = (id: string, changes: ToastUpdate) => {
    const toasterId = findToasterIdFor(id);
    if (toasterId === undefined) return;
    const { duration, ...rest } = changes;
    const patch: Partial<Toast> & { id: string } = { ...(rest as Partial<Toast>), id };
    if (duration !== undefined) {
      patch.duration = typeof duration === 'number' ? duration : resolveDuration(duration, Infinity);
      patch.durationPreset = typeof duration === 'string' ? duration : undefined;
      // A new duration counts from now.
      patch.createdAt = Date.now();
      patch.pauseDuration = 0;
    }
    if (changes.progress !== undefined) applyOwnProgress(id, changes.progress);
    dispatch({ type: ActionType.UPDATE_TOAST, toast: patch }, toasterId);
  };

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

  api.progress = (message: Message, options?: ToastOptions): ProgressController => {
    const id = api.loading(message, { duration: Infinity, ...options, progress: options?.progress ?? 0 });
    // Ending a progress toast clears what made it one, so the success or
    // error toast that replaces it under the same id draws no bar.
    const ended = { progress: undefined, progressSegments: undefined, timestamp: undefined } as ToastOptions;
    return {
      id,
      set: (progress) => setProgress(id, progress),
      update: (changes) => api.update(id, changes),
      success: (msg, opts) => {
        api.success(msg, { ...ended, ...opts, id });
      },
      error: (msg, opts) => {
        api.error(msg, { ...ended, ...opts, id });
      },
      dismiss: () => api.dismiss(id),
    };
  };

  api.steps = (labels: string[], options?: ToastOptions): StepsController => {
    const total = Math.max(labels.length, 1);
    const label = (index: number) => `${index + 1}/${total}`;
    // "2/3" is for the eye; a screen reader hears "Uploading, step 2 of 3".
    // A label passed in by the caller is theirs, and is left alone.
    const ownLabel = options?.accessibilityLabel !== undefined;
    const spoken = (index: number) => (ownLabel ? options!.accessibilityLabel : `${labels[index] ?? ''}, step ${index + 1} of ${total}`);
    const controller = api.progress(labels[0] ?? '', {
      ...options,
      progressSegments: total,
      timestamp: label(0),
      accessibilityLabel: spoken(0),
    });
    let step = 0;
    const go = (index: number) => {
      step = Math.min(Math.max(index, 0), total - 1);
      // The bar fills the steps already done, plus half of the current one.
      setProgress(controller.id, (step + 0.5) / total);
      api.update(controller.id, { message: labels[step], timestamp: label(step), accessibilityLabel: spoken(step) });
    };
    setProgress(controller.id, 0.5 / total);
    // The outcome is read as itself, not as the last step.
    const finished = (opts?: ToastOptions) => (ownLabel ? opts : ({ accessibilityLabel: undefined, ...opts } as ToastOptions));
    return {
      id: controller.id,
      get step() {
        return step;
      },
      next: () => go(step + 1),
      go,
      update: controller.update,
      success: (message, opts) => controller.success(message, finished(opts)),
      error: (message, opts) => controller.error(message, finished(opts)),
      dismiss: controller.dismiss,
    };
  };

  api.track = <T,>(
    task: (report: (progress: number) => void) => Promise<T>,
    messages: TrackMessages<T>,
    options?: ToastOptions,
  ): Promise<T> => {
    const controller = api.progress(messages.loading, options);
    let run: Promise<T>;
    try {
      run = task(controller.set);
    } catch (cause) {
      run = Promise.reject(cause);
    }
    run.then(
      (value) => {
        const message = messages.success ? resolveValue(messages.success, value) : undefined;
        if (message) controller.success(message);
        else controller.dismiss();
      },
      (cause: unknown) => {
        const message = messages.error ? resolveValue(messages.error, cause) : undefined;
        if (message) controller.error(message);
        else controller.dismiss();
      },
    );
    return run;
  };

  const shaped =
    (variant: NonNullable<ToastOptions['variant']>, fallback: Exclude<ToastType, 'custom'>) =>
    (message: Message, options?: ShapedOptions): string => {
      const { type = fallback, ...rest } = options ?? {};
      return createHandler(type)(message, { ...rest, variant });
    };
  api.hud = shaped('hud', 'success');
  api.banner = shaped('banner', 'info');
  api.island = shaped('island', 'blank');
  api.notify = ({ title, body, type = 'blank', ...options }: NotifyOptions) =>
    createHandler(type)(title, { ...options, description: body, variant: options.variant ?? 'card' });

  return api;
}

export const toast = createToastAPI();
export default toast;