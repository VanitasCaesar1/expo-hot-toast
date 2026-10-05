import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import {
  ActionType,
  DEFAULT_TOASTER_ID,
  destroyToaster,
  dispatch,
  setSettings,
  useToasterStore,
} from './store';
import type { DropPolicy } from './store';
import { toast } from './toast';
import { defaultMotion } from './defaults';
import type {
  DefaultToastOptions,
  Toast,
  ToastPosition,
  ToastType,
} from './types';

export interface UseToasterOptions {
  toastOptions?: DefaultToastOptions;
  toasterId?: string;
  /** Deprecated alias for `visibleToasts`. */
  toastLimit?: number;
  visibleToasts?: number;
  maxPending?: number;
  dropPolicy?: DropPolicy;
  /** Where an unstacked toast anchors, needed to resolve depth per position. */
  defaultPosition?: ToastPosition;
  /**
   * Pause every timer in this region. Used by the Toaster for press-and-hold
   * and by consumers who need to freeze the queue (e.g. a modal opening).
   */
  paused?: boolean;
  /**
   * How long a dismissed toast stays mounted so its exit animation can finish,
   * in ms.
   *
   * This is load-bearing. Reanimated's `exiting` only plays when React unmounts
   * the component — it cannot remove anything from the store itself. Without a
   * scheduled removal, a dismissed toast stays in the array forever: it plays its
   * exit, then sits there at the exit transform, dead but still occupying the
   * screen and a toastLimit slot forever. react-hot-toast has the same concept as
   * `removeDelay`; it is the same mechanism under a different name.
   */
  exitDuration?: number;
}

export interface UseToasterResult {
  /** Within the visible cap, nearest the anchored edge first. */
  toasts: Toast[];
  /** Over the cap. Still stored, timer not armed, promoted on dismissal. */
  pending: Toast[];
  startPause: () => void;
  endPause: () => void;
}

export function useToaster({
  toastOptions = {},
  toasterId = DEFAULT_TOASTER_ID,
  toastLimit,
  visibleToasts,
  maxPending,
  dropPolicy,
  defaultPosition = 'top-center',
  paused,
  exitDuration = 400,
}: UseToasterOptions = {}): UseToasterResult {
  const state = useToasterStore(toastOptions, toasterId);

  /**
   * When each toast first became visible.
   *
   * A toast's timer must run from the moment it is *seen*, not from when it was
   * created. Without this a toast that sat pending longer than its own duration
   * is retired on the very tick it is promoted, so it appears and vanishes before
   * it can be read. Kept in a ref because it is bookkeeping, not render state —
   * mutating it must not schedule a render.
   */
  const visibleSince = useRef(new Map<string, number>()).current;

  // Timing facts the store needs, kept out of the theme object so the core does
  // not depend on the theme layer just to read three numbers.
  const motion = useToasterMotion();

  // Resolve each toast's position once, here, because the visible/pending split
  // is computed per position and `depth` is meaningless without it.
  const toasts = useMemo(
    () =>
      state.toasts.map((t) =>
        t.resolvedPosition === t.position || t.position === undefined
          ? t
          : { ...t, resolvedPosition: t.position },
      ),
    [state.toasts],
  );

  const { pausedAt } = state;

  useEffect(() => {
    const patch: Record<string, unknown> = {};
    // `toastLimit` is honoured but deprecated: `visibleToasts` says what the
    // number means, where `toastLimit` reads as a hard cap.
    if (visibleToasts !== undefined) patch.visibleToasts = visibleToasts;
    if (toastLimit !== undefined) patch.visibleToasts = toastLimit;
    if (maxPending !== undefined) patch.maxPending = maxPending;
    if (dropPolicy !== undefined) patch.dropPolicy = dropPolicy;

    if (Object.keys(patch).length > 0) setSettings(patch, toasterId);
  }, [visibleToasts, toastLimit, maxPending, dropPolicy, toasterId]);

  const startPause = useCallback(() => {
    dispatch({ type: ActionType.START_PAUSE, time: Date.now() }, toasterId);
  }, [toasterId]);

  const endPause = useCallback(() => {
    // Explicit `!== undefined` rather than a truthiness check, so a pause
    // recorded at timestamp 0 still dispatches END_PAUSE and the paused span
    // is banked into pauseDuration.
    if (pausedAt !== undefined) {
      dispatch({ type: ActionType.END_PAUSE, time: Date.now() }, toasterId);
    }
  }, [pausedAt, toasterId]);

  // Explicit `paused` prop is authoritative and overrides press-and-hold state.
  useEffect(() => {
    if (paused === undefined) return;
    if (paused) startPause();
    else endPause();
  }, [paused, startPause, endPause]);

  /**
   * Schedule the unmount that lets the exit animation finish.
   *
   * Keyed by toast id so a toast dismissed twice schedules once, and so a toast
   * revived before its delay elapses (the `toast.promise` loading -> success
   * swap does exactly this) has its pending removal cancelled rather than
   * yanking a live toast off screen.
   *
   * The timer map lives in a ref but is cleared on unmount. react-hot-toast
   * never clears its equivalent, so its pending removals fire into `memoryState`
   * long after the Toaster is gone.
   */
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>()).current;

  useEffect(() => {
    const live = new Set<string>();

    for (const t of toasts) {
      if (t.dismissed) {
        live.add(t.id);
        if (!removalTimers.has(t.id)) {
          const timer = setTimeout(() => {
            removalTimers.delete(t.id);
            // Scoped to this region. Dispatching without a toasterId would
            // remove the id from the default region only, leaving it stranded
            // here — which is precisely the upstream bug this replaces.
            toast.remove(t.id, toasterId);
            // Fired here rather than at dismiss time: the toast is genuinely
            // gone from the screen at this point, and by construction this runs
            // once per dismissal, so consumers do not have to de-duplicate.
            t.onDismiss?.(t.id, t.dismissReason ?? 'programmatic');
          }, exitDuration);
          removalTimers.set(t.id, timer);
        }
      } else {
        // Revived: cancel any removal that was already queued.
        const pending = removalTimers.get(t.id);
        if (pending) {
          clearTimeout(pending);
          removalTimers.delete(t.id);
        }
      }
    }

    // Forget timers for toasts that are no longer in the store at all.
    removalTimers.forEach((timer, id) => {
      if (!live.has(id) && !toasts.some((t) => t.id === id)) {
        clearTimeout(timer);
        removalTimers.delete(id);
      }
    });
  }, [toasts, exitDuration, toasterId, removalTimers]);

  useEffect(
    () => () => {
      removalTimers.forEach((timer) => clearTimeout(timer));
      removalTimers.clear();
    },
    [removalTimers],
  );

  /**
   * Background recovery. On iOS and Android a suspended app freezes timers but
   * not wall-clock time, so a toast that should have expired 10s ago is still
   * sitting in the array on resume. Re-run the expiry check on foreground.
   *
   * rht handles this implicitly because `durationLeft < 0` is recomputed on
   * any re-render; React Native gives us no such render after a resume.
   */
  const wasActive = useRef<AppStateStatus>(AppState.currentState ?? 'active');
  useEffect(() => {
    const isBackgrounded = (state: AppStateStatus | undefined | null): boolean =>
      state === 'inactive' || state === 'background';

    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (isBackgrounded(wasActive.current) && next === 'active') {
          const now = Date.now();
          state.toasts.forEach((t) => {
            if (!t.visible || t.duration === Infinity) return;
            const since = visibleSince.get(t.id) ?? t.createdAt;
            if ((t.duration ?? 0) + t.pauseDuration - motion.enter - (now - since) <= 0) {
              toast.dismiss(t.id, toasterId, 'timeout');
            }
          });
        }
        wasActive.current = next;
      },
    );
    return () => subscription.remove();
  }, [state.toasts, toasterId, motion, visibleSince]);

  /**
   * Split visible from pending, per position.
   *
   * Promotion is deliberately implicit. `toasts` is recomputed as a slice of the
   * live list on every render, so removing a dismissed toast automatically
   * promotes the next one into the freed slot — no imperative promotion step to
   * get wrong, and nothing to desynchronise.
   *
   * `depth` is assigned here because the stagger and the "prefer older news"
   * ordering both depend on knowing how deep in the stack a toast sits, and that
   * is only knowable after the limit has been applied.
   */
  const { visible, pending } = useMemo(() => {
    const cap = state.settings.visibleToasts;
    // depth of the front toast per position. Used both as the running count and
    // as the toast's own depth, so the stagger and the drop ordering can see how
    // far back in the stack a toast sits.
    const filled = new Map<ToastPosition, number>();
    const vis: Toast[] = [];
    const pen: Toast[] = [];

    for (const toast of toasts) {
      const depth = filled.get(toast.resolvedPosition) ?? 0;

      if (depth >= cap) {
        pen.push(toast);
        continue;
      }

      filled.set(toast.resolvedPosition, depth + 1);
      if (!visibleSince.has(toast.id)) visibleSince.set(toast.id, Date.now());
      vis.push({ ...toast, depth });
    }

    // Prune ids that have left the store, or this grows forever.
    if (visibleSince.size > toasts.length) {
      const live = new Set(toasts.map((t) => t.id));
      visibleSince.forEach((_at, id) => {
        if (!live.has(id)) visibleSince.delete(id);
      });
    }

    return { visible: vis, pending: pen };
  }, [toasts, state.settings.visibleToasts, visibleSince]);

  /**
   * Timers, armed for visible toasts only.
   *
   * Three corrections over a plain `setTimeout(duration)`:
   *
   *  - The enter animation is charged to the animation, not to the reader. A
   *    2000ms success toast is on screen for 2000ms but was only readable for
   *    1650ms, because the 350ms entrance came out of the same budget.
   *  - The deadline is staggered by stack depth, so three toasts shown together
   *    retire at 2000 / 2320 / 2640 rather than all on the same frame.
   *  - Pending toasts arm nothing. A toast that is merely queued should not
   *    expire before it is ever seen.
   */

  useEffect(() => {
    if (pausedAt !== undefined) return;

    const now = Date.now();
    const timers = visible
      .filter((t) => t.visible && t.duration !== Infinity)
      .map((t) => {
        const stagger = Math.min(t.depth * motion.stagger, motion.staggerMax);
        // Measured from when the toast became visible, falling back to creation
        // for the rare render where the map has not been written yet.
        const since = visibleSince.get(t.id) ?? t.createdAt;
        const budget =
          (t.duration ?? 0) + t.pauseDuration + stagger - motion.enter - (now - since);

        if (budget <= 0) {
          toast.dismiss(t.id, toasterId, 'timeout');
          return undefined;
        }

        return setTimeout(() => {
          toast.dismiss(t.id, toasterId, 'timeout');
        }, budget);
      })
      .filter(Boolean) as ReturnType<typeof setTimeout>[];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [visible, pausedAt, toasterId, motion, visibleSince]);

  return { toasts: visible, pending, startPause, endPause };
}

/**
 * Motion settings for timer maths.
 *
 * Kept out of the theme object deliberately: stagger and enter are timing facts
 * the store needs, and threading a whole resolved theme through the hook purely
 * to read three numbers would couple the core to the theme layer.
 */
function useToasterMotion() {
  return useMemo(
    () => ({ enter: defaultMotion.enter, stagger: defaultMotion.stagger, staggerMax: defaultMotion.staggerMax }),
    [],
  );
}

export interface UseToasterCleanupOptions {
  toasterId?: string;
  /** Drop this region's stored state on unmount. Default true. */
  destroyOnUnmount?: boolean;
}

/**
 * Call from a Toaster's unmount. Clears the region's state so a detached
 * Toaster stops accumulating toasts and no timers survive to dispatch into it.
 *
 * react-hot-toast leaks exactly here: its `toastTimeouts` map is a
 * `useRef().current` that is never cleared, so pending removals fire into
 * `memoryState` after the component is gone.
 */
export function useToasterCleanup({
  toasterId = DEFAULT_TOASTER_ID,
  destroyOnUnmount = true,
}: UseToasterCleanupOptions = {}): void {
  useEffect(
    () => () => {
      if (destroyOnUnmount) destroyToaster(toasterId);
    },
    [toasterId, destroyOnUnmount],
  );
}

export type { ToastType };