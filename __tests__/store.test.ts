import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../src/core/toast';
import {
  ActionType,
  __resetStore,
  destroyToaster,
  dispatch,
  getState,
  reducer,
  resolveToast,
  setSettings,
  subscribe,
  useToasterStore,
} from '../src/core/store';
import type { ToasterState } from '../src/core/store';
import { mergeTheme, defaultTheme } from '../src/core/defaults';
import { genId, __resetIdCounter } from '../src/core/ids';
import { toastCssVars } from '../src/theme/css-vars';
import type { Toast } from '../src/core/types';

const baseToast = (over: Partial<Toast> = {}): Toast => ({
  type: 'blank',
  id: genId(),
  message: 'hi',
  pauseDuration: 0,
  // Derived by the queue in production: the anchor the toast resolved to, and
  // its place in that anchor's stack.
  resolvedPosition: 'top-center',
  depth: 0,
  createdAt: Date.now(),
  visible: true,
  dismissed: false,
  ...over,
});

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
});

describe('ids', () => {
  it('never repeats, even at counter scale', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => genId()));
    expect(ids.size).toBe(5000);
  });

  it('does not collide across separate library copies', () => {
    // rht uses a bare module counter, so two bundle copies both emit "1".
    // The time+random component is what prevents that.
    __resetIdCounter();
    const first = genId();
    const firstCounterValue = first.split('-')[1];
    const second = genId();
    expect(second.split('-')[1]).not.toBe('');
    expect(firstCounterValue).toBeTruthy();
    expect(first).not.toBe(second);
  });
});

describe('reducer', () => {
  const initial: ToasterState = {
    toasts: [],
    pausedAt: undefined,
    settings: { visibleToasts: 3, maxPending: 10, dropPolicy: 'oldest' },
  };

  /**
   * Capacity is `visibleToasts + maxPending`, and the drop policy is only
   * consulted once it is exceeded. Every store array is newest-first, so index 0
   * is the most recent arrival.
   */
  const overflowing: ToasterState = {
    ...initial,
    settings: { visibleToasts: 2, maxPending: 1, dropPolicy: 'oldest' },
  };

  it('leaves everything alone while the queue is within capacity', () => {
    let state = reducer(overflowing, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'a' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'b' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'c' }) });

    // 2 + 1 = 3, so the third toast is queued rather than dropped. The cap is
    // soft; a slice would have deleted 'a' here.
    expect(state.toasts).toHaveLength(3);
    expect(state.toasts.every((t) => t.visible && !t.dismissed)).toBe(true);
  });

  it('marks the overflow victim instead of deleting it', () => {
    let state = reducer(overflowing, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'a' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'b' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'c' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'd' }) });

    expect(state.toasts).toHaveLength(4);

    // The point of the fix: the victim is still present so React can animate it
    // out. rht's .slice(0, limit) drops it from the array, which unmounts it with
    // no exit animation at all.
    const victim = state.toasts.find((t) => t.id === 'd');
    expect(victim).toBeDefined();
    expect(victim!.visible).toBe(false);
    expect(victim!.dismissed).toBe(true);
    expect(victim!.dismissReason).toBe('overflow');
    expect(state.toasts.filter((t) => !t.dismissed)).toHaveLength(3);
  });

  it("'newest' sacrifices the far end of the array instead", () => {
    const newest: ToasterState = {
      ...overflowing,
      settings: { ...overflowing.settings, dropPolicy: 'newest' },
    };

    let state = reducer(newest, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'a' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'b' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'c' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'd' }) });

    expect(state.toasts.filter((t) => t.dismissReason === 'overflow')).toHaveLength(1);
    expect(state.toasts.find((t) => t.id === 'a')!.dismissReason).toBe('overflow');
    expect(state.toasts.find((t) => t.id === 'd')!.dismissed).toBe(false);
  });

  it('upsert updates in place instead of appending', () => {
    const a = baseToast({ id: 'a', type: 'loading', message: 'Loading' });
    let state = reducer(initial, { type: ActionType.ADD_TOAST, toast: a });
    state = reducer(state, {
      type: ActionType.UPSERT_TOAST,
      toast: { ...a, type: 'success', message: 'Done', dismissed: false },
    });

    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0]!.type).toBe('success');
    expect(state.toasts[0]!.message).toBe('Done');
  });

  it('reviving a dismissed toast clears the dismissal', () => {
    // This is what makes toast.promise work: the loading toast is dismissed or
    // replaced by an upsert on the same id, which must cancel the pending removal.
    const a = baseToast({ id: 'a' });
    let state = reducer(initial, { type: ActionType.ADD_TOAST, toast: a });
    state = reducer(state, { type: ActionType.DISMISS_TOAST, toastId: 'a' });
    expect(state.toasts[0]!.visible).toBe(false);

    state = reducer(state, {
      type: ActionType.UPSERT_TOAST,
      toast: { ...a, message: 'ok' },
    });
    expect(state.toasts[0]!.visible).toBe(true);
    expect(state.toasts[0]!.dismissed).toBe(false);
  });

  it('END_PAUSE credits the paused span to every toast', () => {
    const t0 = 1_000_000;
    const a = baseToast({ id: 'a', pauseDuration: 0 });
    let state = reducer(initial, { type: ActionType.ADD_TOAST, toast: a });
    state = reducer(state, { type: ActionType.START_PAUSE, time: t0 });
    state = reducer(state, { type: ActionType.END_PAUSE, time: t0 + 2_500 });

    expect(state.pausedAt).toBeUndefined();
    expect(state.toasts[0]!.pauseDuration).toBe(2_500);
  });

  it('dismisses every toast when given no id', () => {
    let state = reducer(initial, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'a' }) });
    state = reducer(state, { type: ActionType.ADD_TOAST, toast: baseToast({ id: 'b' }) });
    state = reducer(state, { type: ActionType.DISMISS_TOAST, toastId: undefined });

    expect(state.toasts.every((t) => !t.visible)).toBe(true);
  });
});

describe('resolveToast', () => {
  it('falls back to the per-type duration table', () => {
    const resolved = resolveToast(baseToast({ type: 'success' }));
    expect(resolved.duration).toBe(2000);

    const loading = resolveToast(baseToast({ type: 'loading' }));
    expect(loading.duration).toBe(Infinity);
  });

  it('gives the toast precedence over the Toaster default', () => {
    const resolved = resolveToast(baseToast({ type: 'blank', duration: 999 }), {
      duration: 1000,
    });
    expect(resolved.duration).toBe(999);
  });

  it('lets per-type defaults beat global defaults', () => {
    const resolved = resolveToast(baseToast({ type: 'success' }), {
      duration: 5000,
      success: { duration: 1234 },
    });
    expect(resolved.duration).toBe(1234);
  });

  it('drops a key entirely rather than storing an explicit undefined', () => {
    // An explicit undefined shadows any fallback applied downstream, which is
    // exactly how react-hot-toast's spread-based resolution misbehaves.
    const resolved = resolveToast(baseToast({ position: undefined }), {
      position: 'bottom-left',
    });
    expect(resolved.position).toBe('bottom-left');
  });

  it('merges styles with the toast winning', () => {
    const resolved = resolveToast(baseToast({ style: { opacity: 0.5 } }), {
      style: { backgroundColor: 'red' },
    });
    expect(Array.isArray(resolved.style)).toBe(true);
  });
});

/**
 * `action` is the one `ToastOptions` field that carries behaviour rather than
 * appearance, so it has to survive the merge intact: a Toaster-level default
 * action is how an app offers "Undo" on every toast without repeating it per
 * call site, and it silently renders nothing if the merge drops it.
 */
describe('resolveToast — action', () => {
  const undo = { label: 'Undo', onPress: () => {} };
  const retry = { label: 'Retry', onPress: () => {} };

  it('applies a Toaster-level default to a toast that sets none', () => {
    const resolved = resolveToast(baseToast(), { action: undo });
    expect(resolved.action).toEqual(undo);
  });

  it('leaves a toast with no action and no default without one', () => {
    // `put` deletes the key rather than writing an explicit undefined, so nothing
    // downstream mistakes "unset" for "set to nothing".
    const resolved = resolveToast(baseToast());
    expect('action' in resolved).toBe(false);
  });

  it('carries a per-toast action through untouched', () => {
    const resolved = resolveToast(baseToast({ action: retry }), {});
    expect(resolved.action).toEqual(retry);
  });

  it('applies a per-type default action', () => {
    const resolved = resolveToast(baseToast({ type: 'error' }), { error: { action: retry } });
    expect(resolved.action).toEqual(retry);
  });

  it('carries the whole action, not just its label', () => {
    // A merge that kept only the string would render a button wired to nothing.
    const onPress = () => {};
    const resolved = resolveToast(baseToast(), {
      action: { label: 'Undo', onPress, color: '#ff0000' },
    });

    expect(resolved.action?.onPress).toBe(onPress);
    expect(resolved.action?.color).toBe('#ff0000');
  });

  it('lets the toast\'s own action win over every Toaster-level default', () => {
    // The documented precedence runs Toaster default -> per-type default -> the
    // toast, and `action` is the field where getting it backwards is most
    // expensive: it carries behaviour, not appearance. A toast that names its own
    // button has made a per-toast decision, and a Toaster-level default exists
    // only to seed the toasts that express no preference. Resolve it the other
    // way and an app-wide "Retry" silently overwrites the "Details" a single
    // toast asked for, with no way for that toast to opt out — and the default
    // that was supposed to be a fallback becomes a ceiling.
    const resolved = resolveToast(baseToast({ action: retry }), { action: undo });
    expect(resolved.action).toEqual(retry);

    // The per-type default sits between the two in the ladder and loses the same
    // way, so the full order is pinned rather than just the outer pair.
    const typed = resolveToast(baseToast({ type: 'error', action: retry }), {
      action: undo,
      error: { action: undo },
    });
    expect(typed.action).toEqual(retry);
  });
});

describe('toast.promise', () => {
  it('resolves messages from `messages`, not from the options bag', async () => {
    // Regression guard. An earlier draft destructured `success`/`error` out of
    // the options bag, shadowing the resolvers, so it looked for a message
    // resolver on the style options and found none — every promise silently
    // dismissed instead of showing a result.
    toast.promise(Promise.resolve('result'), {
      loading: 'Working',
      success: 'Finished',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(getState().toasts[0]!.type).toBe('success');
    expect(getState().toasts[0]!.message).toBe('Finished');
  });

  it('updates the loading toast in place rather than stacking a new one', async () => {
    const p = toast.promise(Promise.resolve('x'), {
      loading: 'Working',
      success: 'Finished',
    });
    await p;
    expect(getState().toasts).toHaveLength(1);
  });

  it('passes the resolved value to a function resolver', async () => {
    await toast.promise(Promise.resolve(7), {
      loading: 'Working',
      success: (value) => `Got ${value}`,
    });
    expect(getState().toasts[0]!.message).toBe('Got 7');
  });

  it('uses the rejection reason in the error resolver', async () => {
    const failure = new Error('nope');
    await expect(
      toast.promise(Promise.reject(failure), {
        loading: 'Working',
        error: (e) => `Failed: ${(e as Error).message}`,
      }),
    ).rejects.toThrow('nope');

    expect(getState().toasts[0]!.type).toBe('error');
    expect(getState().toasts[0]!.message).toBe('Failed: nope');
  });

  it('cannot have its id overridden by success options', async () => {
    // rht builds `{ id, ...opts, ...opts.success }`, so `toastOptions.success.id`
    // replaces the promise's id. The loading toast is then never updated and
    // never dismissed: it sits there spinning forever.
    await toast.promise(Promise.resolve('x'), {
      loading: 'Working',
      success: 'Finished',
    }, { success: { id: 'hijacked' } });

    const ids = getState().toasts.map((t) => t.id);
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe('hijacked');
    expect(getState().toasts[0]!.type).toBe('success');
  });

  it('accepts a thunk', async () => {
    const factory = vi.fn(() => Promise.resolve('lazy'));
    await toast.promise(factory, { loading: 'Working', success: 'Done' });
    expect(factory).toHaveBeenCalledOnce();
    expect(getState().toasts[0]!.message).toBe('Done');
  });

  it('dismisses when the success message resolves falsy', async () => {
    await toast.promise(Promise.resolve('x'), {
      loading: 'Working',
      success: () => '',
    });
    expect(getState().toasts[0]!.visible).toBe(false);
  });
});

describe('routing', () => {
  it('keeps separate toasterIds isolated', () => {
    toast('default one');
    toast('other one', { toasterId: 'sidebar' });

    expect(getState('default').toasts).toHaveLength(1);
    expect(getState('sidebar').toasts).toHaveLength(1);
  });

  it('dismissAll reaches every toaster that holds state', () => {
    toast('a');
    toast('b', { toasterId: 'sidebar' });
    toast.dismissAll();

    expect(getState('default').toasts.every((t) => !t.visible)).toBe(true);
    expect(getState('sidebar').toasts.every((t) => !t.visible)).toBe(true);
  });

  it('scoping dismiss leaves other regions alone', () => {
    toast('a');
    toast('b', { toasterId: 'sidebar' });
    toast.dismiss(undefined, 'sidebar');

    expect(getState('default').toasts[0]!.visible).toBe(true);
    expect(getState('sidebar').toasts[0]!.visible).toBe(false);
  });

  it('remove deletes instantly, dismiss only flags', () => {
    const id = toast('a');
    toast.dismiss(id);
    expect(getState().toasts).toHaveLength(1);
    expect(getState().toasts[0]!.visible).toBe(false);

    toast.remove(id);
    expect(getState().toasts).toHaveLength(0);
  });

  it('honours a configurable visible cap and flags what does not fit', () => {
    // visibleToasts 1 + maxPending 0 leaves no buffer, so the second toast
    // overflows immediately rather than waiting for one to retire.
    setSettings({ visibleToasts: 1, maxPending: 0 }, 'tiny');
    const one = toast('one', { toasterId: 'tiny' });
    toast('two', { toasterId: 'tiny' });

    const state = getState('tiny');
    expect(state.toasts).toHaveLength(2);
    expect(state.toasts.find((t) => t.id === one)!.visible).toBe(true);
    expect(state.toasts.find((t) => t.id !== one)!.visible).toBe(false);
  });
});

describe('toaster settings', () => {
  it('defaults to three visible over a ten-deep pending buffer', () => {
    expect(getState('untouched').settings).toEqual({
      visibleToasts: 3,
      maxPending: 10,
      dropPolicy: 'oldest',
    });
  });

  it('merges a partial update over the current settings', () => {
    setSettings({ visibleToasts: 6 }, 'partial');
    expect(getState('partial').settings).toEqual({
      visibleToasts: 6,
      maxPending: 10,
      dropPolicy: 'oldest',
    });
  });
});

describe('theme', () => {
  it('deep-merges motion so a partial override keeps the easing curves', () => {
    const merged = mergeTheme(defaultTheme, { motion: { enter: 200 } });
    expect(merged.motion.enter).toBe(200);
    // A shallow spread would leave these undefined and crash the animation.
    expect(merged.motion.enterEasing).toBeDefined();
    expect(merged.motion.exitEasing).toBeDefined();
  });

  it('ignores undefined overrides', () => {
    const merged = mergeTheme(defaultTheme, undefined, { radius: 4 });
    expect(merged.radius).toBe(4);
    expect(merged.color).toBe(defaultTheme.color);
  });

  it('uses a different curve for exit than enter', () => {
    // Deliberate in rht: an exit that overshoots reads as a rejection rather
    // than a completion.
    expect(defaultTheme.motion.exitEasing).not.toBe(
      defaultTheme.motion.enterEasing,
    );
  });

  it('emits css custom properties for the styling-lib bridge', () => {
    const vars = toastCssVars();
    expect(vars['--eh-toast-radius']).toBe(defaultTheme.radius);
    expect(vars['--eh-toast-motion-enter']).toBe('350ms');
    expect(Object.keys(vars).some((k) => k.startsWith('--eh-toast-'))).toBe(true);
  });
});

describe('store subscription', () => {
  it('exposes useSyncExternalStore for headless renderers', () => {
    expect(typeof useToasterStore).toBe('function');
  });

  it('notifies only the subscribed region', () => {
    let scoped = 0;
    let other = 0;

    const unsub = subscribe('scoped', () => {
      scoped += 1;
    });
    const unsubOther = subscribe('other', () => {
      other += 1;
    });

    dispatch({ type: ActionType.REMOVE_TOAST, toastId: undefined }, 'scoped');

    expect(scoped).toBe(1);
    expect(other).toBe(0);

    unsub();
    unsubOther();
  });

  it('stops notifying after unsubscribe', () => {
    let count = 0;
    const unsub = subscribe('gone', () => {
      count += 1;
    });
    unsub();
    dispatch({ type: ActionType.REMOVE_TOAST, toastId: undefined }, 'gone');
    expect(count).toBe(0);
  });

  it('destroyToaster drops state so an unmounted region stops accumulating', () => {
    // react-hot-toast leaks here: its pending-removal timers are never cleared,
    // so they fire into memoryState after the Toaster is gone.
    toast('orphan', { toasterId: 'detached' });
    destroyToaster('detached');
    expect(getState('detached').toasts).toHaveLength(0);
  });

  it('has no pending timers that outlive a removal', () => {
    vi.useFakeTimers();
    const id = toast('quick');
    toast.dismiss(id);
    toast.remove(id);
    expect(() => vi.runAllTimers()).not.toThrow();
    vi.useRealTimers();
  });
});