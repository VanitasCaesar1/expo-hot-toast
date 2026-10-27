import { useRef, useSyncExternalStore } from 'react';
import type {
  DefaultToastOptions,
  DismissReason,
  ToastOptions as ToastOptionsLike,
  Toast,
  ToastPosition,
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
  /** Where a toast that names no position goes; the Toaster's `position`. */
  defaultPosition?: ToastPosition;
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
  const capacity = settings.visibleToasts + settings.maxPending;
  // Counted per slot, as the visible cap is: a burst at the top must not drop
  // a toast that sits alone at the bottom.
  const bySlot = new Map<string, Toast[]>();
  for (const t of toasts) {
    if (t.dismissed) continue;
    const slot = toastSlot(t, settings.defaultPosition ?? 'top-center');
    const list = bySlot.get(slot);
    if (list) list.push(t);
    else bySlot.set(slot, [t]);
  }

  const doomed = new Set<string>();
  bySlot.forEach((newestFirst) => {
    const excess = newestFirst.length - capacity;
    if (excess <= 0) return;
    // The store is newest first, so the end of this list is the toast that has
    // been there longest: under first come, first shown, one already on
    // screen. Dropping it keeps the queue moving, and drops nothing unseen.
    // This list was once reversed, which made 'oldest' drop the newest
    // arrival: in a burst every new toast was dismissed the moment it
    // arrived, and the screen showed none of them.
    const dropped = settings.dropPolicy === 'oldest' ? newestFirst.slice(-excess) : newestFirst.slice(0, excess);
    dropped.forEach((t) => doomed.add(t.id));
  });

  if (doomed.size === 0) return toasts;

  return toasts.map((t) =>
    doomed.has(t.id) ? { ...t, visible: false, dismissed: true, dismissReason: 'overflow' as const } : t,
  );
}

/**
 * The slot a toast queues in: its position, except for the shapes drawn
 * somewhere else. A HUD sits in the middle of the screen, the island in the
 * Dynamic Island, a banner against the edge; each has its own slots, so a
 * burst of toasts at the top cannot push an offline banner off the screen.
 */
export function toastSlot(t: Toast, fallback: ToastPosition): string {
  const at = t.position ?? fallback;
  switch (t.variant) {
    case 'hud':
      return 'center';
    case 'island':
      return 'island';
    case 'banner':
      return at.startsWith('bottom') ? 'banner-bottom' : 'banner-top';
    default:
      return at;
  }
}

/**
 * Whether a toast goes ahead of the queue: errors, and toasts marked
 * `important`, the same toasts a screen reader is interrupted for.
 */
export function jumpsQueue(t: Toast): boolean {
  return t.important ?? t.type === 'error';
}

/**
 * Which of one slot's live toasts are on screen, given `cap` places.
 *
 * First come, first shown: the toasts that arrived first take the places,
 * and the rest wait their turn, so a burst plays in the order it was fired
 * and nothing leaves the screen to come back later. A toast that jumps the
 * queue takes a place at once, and the toast that arrived last among those
 * showing waits for it instead.
 *
 * `newestFirst` is in the store's order.
 */
export function onScreen(newestFirst: Toast[], cap: number): Set<string> {
  const oldestFirst = [...newestFirst].reverse();
  const ahead = oldestFirst.filter(jumpsQueue).slice(0, cap);
  const rest = oldestFirst.filter((t) => !jumpsQueue(t)).slice(0, Math.max(cap - ahead.length, 0));
  return new Set([...ahead, ...rest].map((t) => t.id));
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
      const existing = state.toasts.find((t) => t.id === toast.id);
      // One brought back by id while it plays its exit is news again, and
      // joins the queue as the newest arrival. Kept in its old place it
      // counted as the first to arrive, and took the place of the toast that
      // had just moved up.
      if (existing?.dismissed && !toast.dismissed) {
        return {
          ...state,
          toasts: applyDropPolicy([{ ...existing, ...toast }, ...state.toasts.filter((t) => t.id !== toast.id)], state.settings),
        };
      }
      if (existing) {
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
      // A second hold keeps the time the first began: overwriting it would
      // forget the span already paused, and toasts would expire early.
      if (state.pausedAt !== undefined) return state;
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
        // A toast that arrived during the pause, or was replaced during it, is
        // credited only the part it was there for. One credited nothing keeps
        // its object, so its ToastBar's memo holds and it does not re-render.
        toasts: state.toasts.map((t) => {
          const credit = Math.max(0, Math.min(diff, action.time - t.createdAt));
          return credit === 0 ? t : { ...t, pauseDuration: t.pauseDuration + credit };
        }),
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

/**
 * The region currently holding a toast with this id, if any. A live copy wins
 * over one that is only playing its exit, so an update reaches the toast the
 * user can still see.
 */
export function findToasterIdFor(toastId: string): string | undefined {
  let exiting: string | undefined;
  for (const [toasterId, state] of memoryState) {
    const match = state.toasts.find((t) => t.id === toastId);
    if (!match) continue;
    if (!match.dismissed) return toasterId;
    exiting ??= toasterId;
  }
  return exiting;
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

/**
 * How many mounted Toasters use each region. Two Toasters may share an id (a
 * screen and a modal both rendering the default one); unmounting one must not
 * wipe the state the other is still drawing.
 */
const mounts = new Map<string, number>();

/** Count a Toaster in; returns the call that counts it out. */
export function retainToaster(toasterId: string): () => number {
  mounts.set(toasterId, (mounts.get(toasterId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return mounts.get(toasterId) ?? 0;
    released = true;
    const left = (mounts.get(toasterId) ?? 1) - 1;
    if (left > 0) mounts.set(toasterId, left);
    else mounts.delete(toasterId);
    return left;
  };
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

  // The per-type buckets (`success`, `error`, …) are passed through whole:
  // `resolveToast` reads only the bucket matching the toast's type, and no
  // top-level option shares a name with a toast type.
  //
  // Resolved toasts are cached per source toast, so a toast the store did not
  // touch keeps its identity across renders. Re-resolving every toast on every
  // render handed every ToastBar a new object, which defeated its memo: one
  // toast's update re-rendered all of them.
  const options = useStableOptions(toastOptions);
  const cache = useRef({ options, resolved: new WeakMap<Toast, Toast>(), state, toasts: [] as Toast[] });
  const memo = cache.current;
  if (memo.options !== options) {
    memo.options = options;
    memo.resolved = new WeakMap();
    memo.state = undefined as unknown as ToasterState;
  }
  if (memo.state !== state) {
    memo.state = state;
    memo.toasts = state.toasts.map((t) => {
      let out = memo.resolved.get(t);
      if (!out) {
        out = resolveToast(t, options);
        memo.resolved.set(t, out);
      }
      return out;
    });
  }
  return { ...state, toasts: memo.toasts };
}

/**
 * `toastOptions` is usually written inline, a new object on every render. This
 * keeps the previous object while its contents (two levels deep: the options
 * and each per-type bucket) are unchanged, so the cache above survives.
 */
function useStableOptions(options: DefaultToastOptions): DefaultToastOptions {
  const last = useRef(options);
  if (last.current !== options && !sameOptions(last.current, options)) last.current = options;
  return last.current;
}

function sameOptions(a: DefaultToastOptions, b: DefaultToastOptions): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const key of ka) {
    const va = (a as Record<string, unknown>)[key];
    const vb = (b as Record<string, unknown>)[key];
    if (va === vb) continue;
    if (isPlainObject(va) && isPlainObject(vb) && shallowEqual(va, vb)) continue;
    return false;
  }
  return true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((key) => a[key] === b[key]);
}

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

/**
 * Apply Toaster-level defaults to a toast.
 *
 * Precedence, low to high: Toaster defaults -> per-type defaults (e.g.
 * `toastOptions.success`) -> the toast itself — the same order react-hot-toast
 * uses. A default only fills a field the toast left unset; it never overrides
 * one the toast chose.
 */
export function resolveToast(
  toast: Toast,
  options: DefaultToastOptions = {},
): Toast {
  // Indexed by toast field names below, which `DefaultToastOptions` does not
  // declare one-for-one, so it is read through an untyped view.
  const toastOptions = options as Partial<Record<ToastType | string, unknown>>;
  const typeOptions = (options[toast.type] ?? {}) as Partial<Toast>;
  const draft: Toast = { ...toast };

  const pick = <K extends keyof Toast>(key: K): void => {
    put(
      draft,
      key,
      toast[key] ?? typeOptions[key] ?? (toastOptions[key] as Toast[K] | undefined),
    );
  };

  pick('position');
  pick('removeDelay');
  pick('glass');
  pick('richColors');
  pick('haptics');
  pick('description');
  pick('accessibilityLabel');
  pick('dismissOnTap');
  // `closeButton` is the canonical name; `closeable` is honoured as an alias
  // at every level, and each level's own value (under either name) beats the
  // level below it.
  put(
    draft,
    'closeButton',
    toast.closeButton ??
      toast.closeable ??
      typeOptions.closeButton ??
      typeOptions.closeable ??
      ((toastOptions.closeButton ?? toastOptions.closeable) as boolean | undefined),
  );
  pick('closeButtonColor');
  pick('important');
  pick('action');
  pick('dedupeKey');
  // `null` is a real value for the icon (hide it), not an absent one, so it
  // must not fall through to a default the way `??` would let it.
  put(
    draft,
    'icon',
    toast.icon !== undefined
      ? toast.icon
      : typeOptions.icon !== undefined
        ? typeOptions.icon
        : (toastOptions.icon as Toast['icon']),
  );
  pick('iconTheme');
  pick('theme');
  pick('onDismiss');
  pick('cancel');
  pick('dismissible');
  pick('swipeDirections');
  pick('unstyled');
  pick('variant');
  pick('progressStyle');
  // Slot styles and class names merge per slot, low to high, so a default
  // `styles.title` survives a toast that only sets `styles.description`.
  const mergeSlots = (key: 'styles' | 'classNames'): void => {
    const levels = [toastOptions[key], typeOptions[key], toast[key]].filter(Boolean) as Record<string, unknown>[];
    if (levels.length === 0) return;
    if (levels.length === 1) {
      put(draft, key, levels[0] as Toast[typeof key]);
      return;
    }
    const merged: Record<string, unknown> = {};
    for (const level of levels) {
      for (const [slot, value] of Object.entries(level)) {
        const previous = merged[slot];
        merged[slot] =
          key === 'classNames'
            ? [previous, value].filter(Boolean).join(' ')
            : previous === undefined
              ? value
              : [previous, value];
      }
    }
    put(draft, key, merged as Toast[typeof key]);
  };
  mergeSlots('styles');
  mergeSlots('classNames');

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
  mounts.clear();
}