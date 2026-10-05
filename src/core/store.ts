import { useSyncExternalStore } from 'react';
import type {
  DefaultToastOptions,
  DismissReason,
  ToastOptions as ToastOptionsLike,
  Toast,
  ToastType,
} from './types';
import { defaultTimeouts, resolveDuration } from './defaults';

export const DEFAULT_TOASTER_ID = 'default';
export const REMOVE_DELAY = 1000;

export type DropPolicy = 'oldest' | 'newest';

export interface ToasterSettings {
  /**
   * How many toasts are visible per position at once.
   *
   * react-hot-toast hardcodes 20, which is a wall of glass rather than a queue —
   * and its enforcement is `Array.slice`, so the overflow disappears with no exit
   * animation. Both Sonner implementations converge on 3; so does this.
   *
   * The limit is *soft*: anything beyond it stays in the store with its timer
   * unarmed and is promoted into the freed slot on dismissal. Eviction is
   * therefore a deliberate policy (`dropPolicy`) applied only once the pending
   * buffer is also full, never an accident of array length.
   */
  visibleToasts: number;
  /** How many over-limit toasts wait before the drop policy applies. */
  maxPending: number;
  /** Which end of the pending buffer to sacrifice when it overflows. */
  dropPolicy: DropPolicy;
}

export interface ToasterState {
  toasts: Toast[];
  settings: ToasterSettings;
  pausedAt: number | undefined;
}

const defaultToasterState: ToasterState = {
  toasts: [],
  pausedAt: undefined,
  settings: { visibleToasts: 3, maxPending: 10, dropPolicy: 'oldest' },
};

export enum ActionType {
  ADD_TOAST,
  UPDATE_TOAST,
  UPSERT_TOAST,
  DISMISS_TOAST,
  REMOVE_TOAST,
  START_PAUSE,
  END_PAUSE,
}

export type Action =
  | { type: ActionType.ADD_TOAST; toast: Toast }
  | { type: ActionType.UPDATE_TOAST; toast: Partial<Toast> }
  | { type: ActionType.UPSERT_TOAST; toast: Toast }
  | { type: ActionType.DISMISS_TOAST; toastId?: string; reason?: DismissReason }
  | { type: ActionType.REMOVE_TOAST; toastId?: string }
  | { type: ActionType.START_PAUSE; time: number }
  | { type: ActionType.END_PAUSE; time: number };

/**
 * Enforce the pending cap once the visible slots are already taken.
 *
 * Only reached when a caller keeps pushing toasts at a region that is not
 * draining — a runaway loop, not normal use. The dropped toast is marked
 * dismissed rather than spliced out, so it still plays its exit and still
 * reports `overflow` to `onDismiss`; silently vanishing is the upstream bug.
 *
 * Toasts at or under the visible cap are never touched. Promotion is implicit:
 * `visible` is recomputed as a slice of the live list on every render, so
 * removing a toast automatically promotes the next one into its slot.
 */
function applyDropPolicy(toasts: Toast[], settings: ToasterSettings): Toast[] {
  const live = toasts.filter((t) => !t.dismissed).length;
  const capacity = settings.visibleToasts + settings.maxPending;
  if (live <= capacity) return toasts;

  const excess = live - capacity;
  const candidates = toasts.filter((t) => !t.dismissed && t.visible);
  // Newest-first array, so index 0 is the front of the stack.
  const frontToBack = [...candidates].reverse();
  const doomed = new Set(
    (settings.dropPolicy === 'oldest'
      ? frontToBack.slice(-excess)
      : frontToBack.slice(0, excess)
    ).map((t) => t.id),
  );

  if (doomed.size === 0) return toasts;

  return toasts.map((t) =>
    doomed.has(t.id) ? { ...t, visible: false, dismissed: true, dismissReason: 'overflow' as const } : t,
  );
}

export function reducer(state: ToasterState, action: Action): ToasterState {
  switch (action.type) {
    case ActionType.ADD_TOAST:
      return {
        ...state,
        toasts: applyDropPolicy(
          [action.toast, ...state.toasts],
          state.settings,
        ),
      };

    case ActionType.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case ActionType.UPSERT_TOAST: {
      const { toast } = action;
      const exists = state.toasts.some((t) => t.id === toast.id);
      if (exists) {
        return {
          ...state,
          toasts: state.toasts.map((t) => (t.id === toast.id ? { ...t, ...toast } : t)),
        };
      }
      return {
        ...state,
        toasts: applyDropPolicy([toast, ...state.toasts], state.settings),
      };
    }

    case ActionType.DISMISS_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) => {
          const targeted =
            t.id === action.toastId || action.toastId === undefined;
          if (!targeted || t.dismissed) return t;
          // First reason wins. A toast that timed out and was then swiped away
          // should report the timeout: that is the cause which explains it, and
          // the one worth measuring.
          return {
            ...t,
            dismissed: true,
            visible: false,
            dismissReason: t.dismissReason ?? action.reason ?? 'programmatic',
          };
        }),
      };

    case ActionType.REMOVE_TOAST: {
      if (action.toastId === undefined) return { ...state, toasts: [] };
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
    }

    case ActionType.START_PAUSE:
      return { ...state, pausedAt: action.time };

    case ActionType.END_PAUSE: {
      // `??` rather than `||`: a pause recorded at exactly Date.now() === 0 is
      // falsy, and `|| 0` would silently credit zero elapsed time. `??` keeps a
      // legitimate 0 distinct from "never paused".
      const startedAt = state.pausedAt ?? 0;
      const diff = action.time - startedAt;
      return {
        ...state,
        pausedAt: undefined,
        toasts: state.toasts.map((t) => ({ ...t, pauseDuration: t.pauseDuration + diff })),
      };
    }

    default:
      return state;
  }
}

type Listener = (toasterId: string) => void;

/**
 * module-level state, keyed by toasterId, plus per-toaster subscriptions.
 *
 * Kept in a Map rather than a plain object so `dispatchAll` can enumerate with
 * proper iteration and so a toaster that has never received a dispatch can
 * still be seeded by the Toaster on mount.
 */
let memoryState = new Map<string, ToasterState>();
const listeners = new Map<string, Set<Listener>>();

function readState(toasterId: string): ToasterState {
  return memoryState.get(toasterId) ?? defaultToasterState;
}

export function getState(toasterId: string = DEFAULT_TOASTER_ID): ToasterState {
  return readState(toasterId);
}

function emit(toasterId: string): void {
  listeners.get(toasterId)?.forEach((listener) => listener(toasterId));
}

export function dispatch(
  action: Action,
  toasterId: string = DEFAULT_TOASTER_ID,
): void {
  const next = reducer(readState(toasterId), action);
  memoryState.set(toasterId, next);
  emit(toasterId);
}

export function dispatchAll(action: Action): void {
  // Iterate a snapshot: a listener may synchronously dispatch (e.g. a Toaster
  // that seeds state on mount) and mutate the Map underneath us.
  Array.from(memoryState.keys()).forEach((id) => dispatch(action, id));
}

export function setSettings(
  settings: Partial<ToasterSettings>,
  toasterId: string = DEFAULT_TOASTER_ID,
): void {
  const current = readState(toasterId);
  memoryState.set(toasterId, {
    ...current,
    settings: { ...current.settings, ...settings },
  });
  emit(toasterId);
}

/**
 * Drop a toaster's state entirely. Called on Toaster unmount so a detached
 * region doesn't keep accumulating toasts and pinning timers.
 */
export function destroyToaster(toasterId: string): void {
  memoryState.delete(toasterId);
  listeners.delete(toasterId);
}

/** Subscribe. Returns an unsubscribe function. */
export function subscribe(toasterId: string, listener: Listener): () => void {
  let set = listeners.get(toasterId);
  if (!set) {
    set = new Set();
    listeners.set(toasterId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(toasterId);
  };
}

export function useToasterStore(
  toastOptions: DefaultToastOptions = {},
  toasterId: string = DEFAULT_TOASTER_ID,
): ToasterState {
  // useSyncExternalStore rather than useState + a manual listener list.
  // The listener approach in react-hot-toast can tear under concurrent
  // rendering, because a component can read state mid-dispatch and get a
  // value that no longer matches what the store holds. This is the whole
  // reason the hook exists.
  const state = useSyncExternalStore(
    (listener) => subscribe(toasterId, listener),
    () => readState(toasterId),
    () => defaultToasterState,
  );

  // Per-type buckets live under keys named after the toast type; they must not
  // be mistaken for top-level Toaster options.
  const { blank, custom, error, loading, success, ...rest } = toastOptions;
  void blank;
  void custom;
  void error;
  void loading;
  void success;

  return { ...state, toasts: state.toasts.map((t) => resolveToast(t, rest)) };
}

/**
 * Precedence, low to high: type defaults -> Toaster defaults -> the toast.
 *
 * `duration` is re-derived explicitly because the spread of `t` would carry an
 * explicit `undefined` and shadow the fallback (react-hot-toast hits this and
 * re-derives for the same reason).
 */
/**
 * Write-or-delete a key without leaving a cast at every call site.
 *
 * The dance is deliberate: when a toast leaves a field undefined we *remove* it
 * rather than leaving an explicit `undefined`, because an explicit undefined
 * shadows any fallback applied later during resolution.
 */
function put<K extends keyof Toast>(
  draft: Toast,
  key: K,
  value: Toast[K] | undefined,
): void {
  const bag = draft as unknown as Record<string, unknown>;
  if (value === undefined) delete bag[key];
  else bag[key] = value;
}

export function resolveToast(
  toast: Toast,
  toastOptions: Partial<Record<ToastType | string, unknown>> = {},
): Toast {
  const typeOptions = (toastOptions[toast.type] ?? {}) as Partial<Toast>;
  const draft: Toast = { ...toast };

  // Low to high: Toaster defaults -> per-type defaults -> the toast itself.
  //
  // The toast MUST come last. Reading the Toaster default first inverts the
  // precedence the comment above describes and silently makes every Toaster-level
  // default beat the toast that was supposed to override it — a per-toaster
  // default `action`, for instance, would stomp on the toast's own.
  const pick = <K extends keyof Toast>(key: K): void => {
    put(
      draft,
      key,
      (toastOptions[key] as Toast[K] | undefined) ??
        typeOptions[key] ??
        toast[key],
    );
  };

  /** Same precedence, but the toast's own value wins outright. */
  const preferToast = <K extends keyof Toast>(key: K): void => {
    put(
      draft,
      key,
      toast[key] ?? typeOptions[key] ?? (toastOptions[key] as Toast[K] | undefined),
    );
  };

  pick('position');
  pick('glass');
  pick('accessibilityLabel');
  pick('dismissOnTap');
  // `closeButton` is the canonical name; `closeable` is honoured as an alias
  // from any of the three sources, so an existing caller using the old name at
  // any level keeps working.
  preferToast('closeButton');
  if (draft.closeButton === undefined) {
    const legacy =
      toast.closeable ?? typeOptions.closeable ?? toastOptions.closeable;
    if (typeof legacy === 'boolean') draft.closeButton = legacy;
  }
  pick('closeButtonColor');
  pick('important');
  // These describe the toast's own interaction, so a Toaster default must not
  // override an explicit per-toast value.
  preferToast('action');
  pick('dedupeKey');
  pick('icon');
  pick('theme');

  // Style props merge into an array; React Native flattens it itself and later
  // entries win. A single remaining entry is unwrapped so `StyleProp` stays a
  // plain object, which keeps snapshot tests and `.length` checks sane.
  const mergeStyle = (key: 'style' | 'textStyle' | 'iconStyle'): void => {
    const merged = [
      (toastOptions[key] as Toast['style']),
      typeOptions[key],
      toast[key],
    ].filter(Boolean);

    if (merged.length === 1) put(draft, key, merged[0] as Toast['style']);
    else if (merged.length > 1) put(draft, key, merged as Toast['style']);
    else delete (draft as unknown as Record<string, unknown>)[key];
  };

  mergeStyle('style');
  mergeStyle('textStyle');
  mergeStyle('iconStyle');

  // `...t` would carry an explicit undefined and shadow the fallback, so
  // duration is re-derived rather than spread.
  const requested =
    toast.durationPreset ??
    toast.duration ??
    typeOptions.duration ??
    (toastOptions.duration as ToastOptionsLike['duration']) ??
    undefined;

  draft.durationPreset =
    typeof requested === 'string' ? requested : toast.durationPreset;

  draft.duration = resolveDuration(requested, defaultTimeouts[toast.type]);

  return draft;
}

export function resolveValue<T, P>(
  value: T | ((props: P) => T),
  props: P,
): T {
  return typeof value === 'function'
    ? (value as (props: P) => T)(props)
    : value;
}

/* ------------------------------------------------------------------ */
/* Deduplication                                                       */
/* ------------------------------------------------------------------ */

/**
 * Recently-shown dedupe keys, per toaster.
 *
 * A toast carrying an unchanged `dedupeKey` inside its window returns the live
 * toast's id instead of stacking a second copy. This is the fix for the spinner
 * that fires twenty times a second: twenty stacked toasts say nothing, whereas
 * one that transitions in place says a lot.
 *
 * Bounded, because an unbounded Map keyed on arbitrary user input is a slow leak
 * in a component whose whole job is to avoid allocating.
 */
const DEFAULT_DEDUPE_WINDOW = 1000;
const MAX_DEDUPE_ENTRIES = 500;

const dedupeRegistries = new Map<string, Map<string, { id: string; at: number }>>();

export function findDedupeHit(
  toasterId: string,
  key: string,
  windowMs: number,
  now: number = Date.now(),
): string | null {
  const registry = dedupeRegistries.get(toasterId);
  const hit = registry?.get(key);
  if (!hit) return null;
  if (now - hit.at > windowMs) {
    registry!.delete(key);
    return null;
  }
  return hit.id;
}

export function recordDedupe(
  toasterId: string,
  key: string,
  id: string,
  now: number = Date.now(),
): void {
  let registry = dedupeRegistries.get(toasterId);
  if (!registry) {
    registry = new Map();
    dedupeRegistries.set(toasterId, registry);
  }

  // Re-inserting moves the key to the end of insertion order, so evicting the
  // oldest key is genuinely oldest-first.
  registry.delete(key);
  registry.set(key, { id, at: now });

  while (registry.size > MAX_DEDUPE_ENTRIES) {
    const oldest = registry.keys().next();
    if (oldest.done) break;
    registry.delete(oldest.value);
  }
}

export { DEFAULT_DEDUPE_WINDOW };

/** Test-only. */
export function __resetStore(): void {
  memoryState = new Map();
  listeners.clear();
  dedupeRegistries.clear();
}