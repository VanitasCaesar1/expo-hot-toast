import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import {
  ActionType,
  DEFAULT_TOASTER_ID,
  destroyToaster,
  dispatch,
  getState,
  setSettings,
  toastSlot,
  useToasterStore,
} from './store';
import type { DropPolicy } from './store';
import { toast } from './toast';
import { defaultMotion } from './defaults';
import type {
  DefaultToastOptions,
  MotionConfig,
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
   * `removeDelay`, which overrides this per toast (see `ToastOptions.removeDelay`).
   */
  exitDuration?: number;
  /**
   * The motion values the timers depend on. The Toaster passes its theme's, so
   * a retuned `enter` or `stagger` moves the deadlines with the animation.
   * Defaults to `defaultMotion`.
   */
  motion?: Partial<Pick<MotionConfig, 'enter' | 'stagger' | 'staggerMax'>>;
}

export interface UseToasterResult {
  /** Within the visible cap, nearest the anchored edge first. */
  toasts: Toast[];
  /** Over the cap. Still stored, timer not armed, promoted on dismissal. */
  pending: Toast[];
  startPause: () => void;
  endPause: () => void;
  /**
   * The same two functions, grouped the way react-hot-toast returns them, so
   * `const { toasts, handlers } = useToaster()` compiles unchanged.
   */
  handlers: { startPause: () => void; endPause: () => void };
  /** True while the timers are paused: by a press, or the `paused` option. */
  paused: boolean;
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
  motion: motionOverride,
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
  /**
   * The pause credit each toast already held when it was shown. A toast that
   * waited behind others through a pause was not on screen for it, so that
   * credit must not lengthen its time once it is.
   */
  const creditAtShow = useRef(new Map<string, number>()).current;

  // Timing facts the store needs, kept out of the theme object so the core does
  // not depend on the theme layer just to read three numbers.
  const motion = useToasterMotion(motionOverride);

  // Resolve each toast's position once, here, because the visible/pending split
  // is computed per position and `depth` is meaningless without it.
  //
  // A toast that names no position belongs to the Toaster's default, not to
  // `createToast`'s 'top-center' placeholder. Without this a bottom-anchored
  // Toaster counted its toasts against the top-center bucket, so the visible cap
  // and the stagger depth were computed for a stack that is not on screen.
  // Copies are cached by source toast, for the same reason as in the store:
  // an untouched toast must keep its identity.
  const placed = useRef({ position: defaultPosition, map: new WeakMap<Toast, Toast>() }).current;
  if (placed.position !== defaultPosition) {
    placed.position = defaultPosition;
    placed.map = new WeakMap();
  }
  const toasts = useMemo(
    () =>
      state.toasts.map((t) => {
        const resolved = t.position ?? defaultPosition;
        if (t.resolvedPosition === resolved) return t;
        let out = placed.map.get(t);
        if (!out) {
          out = { ...t, resolvedPosition: resolved };
          placed.map.set(t, out);
        }
        return out;
      }),
    [state.toasts, defaultPosition, placed],
  );
  // The same for the depth stamped on each visible toast below.
  const deep = useRef(new WeakMap<Toast, Map<number, Toast>>()).current;

  const { pausedAt } = state;

  useEffect(() => {
    const patch: Record<string, unknown> = {};
    // `toastLimit` is honoured but deprecated: `visibleToasts` says what the
    // number means, where `toastLimit` reads as a hard cap.
    if (visibleToasts !== undefined) patch.visibleToasts = visibleToasts;
    if (toastLimit !== undefined) patch.visibleToasts = toastLimit;
    if (maxPending !== undefined) patch.maxPending = maxPending;
    if (dropPolicy !== undefined) patch.dropPolicy = dropPolicy;
    // The drop policy counts per slot, and a toast with no position takes
    // this Toaster's.
    if (getState(toasterId).settings.defaultPosition !== defaultPosition) patch.defaultPosition = defaultPosition;

    if (Object.keys(patch).length > 0) setSettings(patch, toasterId);
  }, [visibleToasts, toastLimit, maxPending, dropPolicy, toasterId, defaultPosition]);

  // Read through a ref, so `endPause` keeps its identity while a press pauses
  // the queue. Depending on `pausedAt` made it a new function on every pause,
  // which re-rendered every toast the moment one was touched.
  const pausedAtRef = useRef(pausedAt);
  pausedAtRef.current = pausedAt;
  const resume = useCallback(() => {
    // Explicit `!== undefined` rather than a truthiness check, so a pause
    // recorded at timestamp 0 still dispatches END_PAUSE and the paused span
    // is banked into pauseDuration.
    if (getState(toasterId).pausedAt !== undefined) {
      dispatch({ type: ActionType.END_PAUSE, time: Date.now() }, toasterId);
    }
  }, [toasterId]);

  /**
   * Pauses are counted. Several things can hold the queue at once (an
   * expanded toast, a press, the pointer over a toast, the `paused` option),
   * and it resumes when the last lets go. One flag meant a press ending on one
   * toast resumed the timers under another that was still expanded, or under
   * a modal that had asked for `paused`.
   */
  const holds = useRef(0);
  const pausedOption = useRef(paused);
  pausedOption.current = paused;
  const startPause = useCallback(() => {
    holds.current += 1;
    dispatch({ type: ActionType.START_PAUSE, time: Date.now() }, toasterId);
  }, [toasterId]);
  const endPause = useCallback(() => {
    if (holds.current === 0) return;
    holds.current -= 1;
    if (holds.current === 0 && !pausedOption.current) resume();
  }, [resume]);

  // The `paused` option holds the queue for as long as it is set.
  useEffect(() => {
    if (paused === undefined) return;
    if (paused) dispatch({ type: ActionType.START_PAUSE, time: Date.now() }, toasterId);
    else if (holds.current === 0) resume();
  }, [paused, toasterId, resume]);

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
            // Brought back since, in the frame before this effect could
            // cancel the timer: `toast.promise`'s outcome landing as its
            // dismissed loading toast's removal fires. It stays.
            const now = getState(toasterId).toasts.find((x) => x.id === t.id);
            if (now && !now.dismissed) return;
            // Scoped to this region. Dispatching without a toasterId would
            // remove the id from the default region only, leaving it stranded
            // here — which is precisely the upstream bug this replaces.
            toast.remove(t.id, toasterId);
            // Fired here rather than at dismiss time: the toast is genuinely
            // gone from the screen at this point, and by construction this runs
            // once per dismissal, so consumers do not have to de-duplicate.
            t.onDismiss?.(t.id, t.dismissReason ?? 'programmatic');
          }, t.removeDelay ?? exitDuration);
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
  /**
   * When each toast was pushed out of the visible slots by newer ones. For
   * one exit's length it is still rendered, flagged `queued`, so it leaves
   * like a dismissed toast instead of vanishing on the spot.
   */
  const displacedAt = useRef(new Map<string, number>()).current;
  // Bumped when a displaced toast's exit is over, to drop it from the render.
  const [exitTick, setExitTick] = useState(0);

  const { visible, pending } = useMemo(() => {
    const cap = state.settings.visibleToasts;
    const now = Date.now();
    // depth of the front toast per position. Used both as the running count and
    // as the toast's own depth, so the stagger and the drop ordering can see how
    // far back in the stack a toast sits.
    const filled = new Map<string, number>();
    // Depth counts every toast drawn ahead, leaving ones included, so a toast
    // keeps its staggered deadline while the one in front plays its exit.
    const ahead = new Map<string, number>();
    const vis: Toast[] = [];
    const pen: Toast[] = [];

    const stamp = (toast: Toast, depth: number, queued: boolean): Toast => {
      if (toast.depth === depth && !queued && !toast.queued) return toast;
      let byDepth = deep.get(toast);
      if (!byDepth) {
        byDepth = new Map();
        deep.set(toast, byDepth);
      }
      const key = queued ? -1 - depth : depth;
      let stamped = byDepth.get(key);
      if (!stamped) {
        stamped = { ...toast, depth, queued: queued || undefined };
        byDepth.set(key, stamped);
      }
      return stamped;
    };

    // Shapes drawn elsewhere (a HUD, the island, a banner) queue on their own.
    const slotOf = (toast: Toast) => toastSlot(toast, toast.resolvedPosition);
    const exiting = (id: string) => {
      const since = displacedAt.get(id);
      return since !== undefined && now - since < exitDuration;
    };

    for (const toast of toasts) {
      const pos = slotOf(toast);
      const used = filled.get(pos) ?? 0;
      const depth = ahead.get(pos) ?? 0;

      // A dismissed toast is leaving: it no longer holds a slot, so the next
      // toast moves up at once instead of waiting for the exit to finish. It
      // is still rendered, in place, if it was on screen. One pushed back
      // earlier has already played its exit and stays off screen.
      if (toast.dismissed) {
        if (visibleSince.has(toast.id) || exiting(toast.id)) {
          vis.push(stamp(toast, depth, false));
          ahead.set(pos, depth + 1);
        }
        continue;
      }

      if (used >= cap) {
        // Pushed out by newer toasts. It forgets when it was first shown, or
        // its clock keeps running while it waits and it is retired on the tick
        // it returns; and it leaves with an exit rather than vanishing.
        if (visibleSince.delete(toast.id)) displacedAt.set(toast.id, now);
        if (exiting(toast.id)) vis.push(stamp(toast, depth, true));
        pen.push(toast);
        continue;
      }

      filled.set(pos, used + 1);
      ahead.set(pos, depth + 1);
      displacedAt.delete(toast.id);
      if (!visibleSince.has(toast.id)) {
        visibleSince.set(toast.id, now);
        // Shown during a pause: the part of it already over was not seen.
        const pausedAt = pausedAtRef.current;
        const running = pausedAt === undefined ? 0 : now - Math.max(pausedAt, toast.createdAt);
        creditAtShow.set(toast.id, toast.pauseDuration + Math.max(running, 0));
      }
      vis.push(stamp(toast, depth, false));
    }

    // Prune ids that have left the store, or these grow forever.
    if (visibleSince.size + displacedAt.size > toasts.length) {
      const live = new Set(toasts.map((t) => t.id));
      visibleSince.forEach((_at, id) => {
        if (!live.has(id)) visibleSince.delete(id);
      });
      creditAtShow.forEach((_at, id) => {
        if (!live.has(id)) creditAtShow.delete(id);
      });
      displacedAt.forEach((_at, id) => {
        if (!live.has(id)) displacedAt.delete(id);
      });
    }

    return { visible: vis, pending: pen };
    // `exitTick` re-runs this once a displaced toast's exit is over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toasts, state.settings.visibleToasts, visibleSince, deep, displacedAt, exitDuration, exitTick]);

  // Once the earliest displaced toast's exit is over, re-render to drop it.
  useEffect(() => {
    if (!visible.some((t) => t.queued)) return undefined;
    const now = Date.now();
    let next = Infinity;
    // Exits already over are skipped: counting them re-rendered every frame.
    displacedAt.forEach((at) => {
      if (at + exitDuration > now) next = Math.min(next, at + exitDuration - now);
    });
    if (!Number.isFinite(next)) return undefined;
    const timer = setTimeout(() => setExitTick((n) => n + 1), Math.max(next, 0) + 16);
    return () => clearTimeout(timer);
  }, [visible, displacedAt, exitDuration]);

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
        // A paused region has no deadlines running; its paused time is only
        // credited on END_PAUSE, so checking now would expire everything.
        if (isBackgrounded(wasActive.current) && next === 'active' && pausedAt === undefined) {
          const now = Date.now();
          // Visible toasts only, with the same budget as the timers below. A
          // pending toast has not been seen yet, so it cannot have expired.
          visible.forEach((t) => {
            if (!t.visible || t.queued || t.duration === Infinity) return;
            if (remaining(t, visibleSince, creditAtShow, motion, now) <= 0) {
              toast.dismiss(t.id, toasterId, 'timeout');
            }
          });
        }
        wasActive.current = next;
      },
    );
    return () => subscription.remove();
  }, [visible, toasterId, motion, visibleSince, creditAtShow, pausedAt]);

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
      .filter((t) => t.visible && !t.queued && t.duration !== Infinity)
      .map((t) => {
        const budget = remaining(t, visibleSince, creditAtShow, motion, now);

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
  }, [visible, pausedAt, toasterId, motion, visibleSince, creditAtShow]);

  // Memoized so `handlers` is as stable as the functions it wraps.
  const handlers = useMemo(() => ({ startPause, endPause }), [startPause, endPause]);

  return { toasts: visible, pending, startPause, endPause, handlers, paused: pausedAt !== undefined };
}

/**
 * Milliseconds left before a visible toast times out.
 *
 * Measured from when the toast became visible, falling back to creation for the
 * rare render where the map has not been written yet. The enter animation is
 * charged to the animation and the deadline is staggered by stack depth.
 */
function remaining(
  t: Toast,
  visibleSince: Map<string, number>,
  creditAtShow: Map<string, number>,
  motion: { enter: number; stagger: number; staggerMax: number },
  now: number,
): number {
  const stagger = Math.min(t.depth * motion.stagger, motion.staggerMax);
  // Only pauses since it was shown count. A toast replaced by id since then
  // starts its credit afresh with its new `createdAt`.
  const since = visibleSince.get(t.id);
  const before = since === undefined || t.createdAt >= since ? 0 : (creditAtShow.get(t.id) ?? 0);
  return (t.duration ?? 0) + t.pauseDuration - before + stagger - motion.enter - (now - shownAt(visibleSince, t));
}

/**
 * When the toast's current content became visible.
 *
 * Usually the moment it entered the visible slice. But a toast updated in place
 * by id — `toast.promise` turning its loading toast into the success or error
 * one is the common case — is re-created with a fresh `createdAt` under the same
 * id. Measuring that toast from when the *loading* toast appeared would charge
 * the whole wait to the outcome: a 1.5s request left a 2000ms success toast on
 * screen for roughly 150ms. The later of the two timestamps is the one the
 * reader actually saw.
 */
function shownAt(visibleSince: Map<string, number>, t: Toast): number {
  const since = visibleSince.get(t.id);
  return since === undefined ? t.createdAt : Math.max(since, t.createdAt);
}

/**
 * Motion settings for timer maths.
 *
 * Kept out of the theme object deliberately: stagger and enter are timing facts
 * the store needs, and threading a whole resolved theme through the hook purely
 * to read three numbers would couple the core to the theme layer.
 */
function useToasterMotion(override: UseToasterOptions['motion']) {
  const enter = override?.enter ?? defaultMotion.enter;
  const stagger = override?.stagger ?? defaultMotion.stagger;
  const staggerMax = override?.staggerMax ?? defaultMotion.staggerMax;
  return useMemo(() => ({ enter, stagger, staggerMax }), [enter, stagger, staggerMax]);
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