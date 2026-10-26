import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Toaster } from '../src/components/toaster';
import { defaultMotion } from '../src/core/defaults';
import { __resetIdCounter } from '../src/core/ids';
import { __resetProgress, progressValue } from '../src/core/progress';
import { ActionType, __resetStore, dispatch, getState } from '../src/core/store';
import { toast } from '../src/core/toast';
import { useToaster } from '../src/core/use-toaster';

/**
 * Bugs of one family: state that has to follow a toast as it moves between the
 * screen and the queue (its exit, its timer, its pause credit, its progress),
 * and the slots that decide which toasts are on screen.
 */

const EXIT = 400;
const deadline = (duration: number) => duration - defaultMotion.enter;

beforeEach(() => {
  jest.useFakeTimers();
  __resetStore();
  __resetIdCounter();
  __resetProgress();
});

afterEach(() => {
  cleanup();
  __resetStore();
  jest.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

describe('a toast pushed back into the queue', () => {
  it('is not drawn again when it is dismissed while it waits', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, exitDuration: EXIT }));
    let first = '';
    act(() => {
      first = toast('first', { duration: 60_000 });
    });
    // An error goes ahead of the queue and pushes the first back.
    act(() => {
      toast.error('second', { duration: 60_000 });
    });
    advance(EXIT + 50);
    expect(result.current.toasts.map((t) => t.message)).toEqual(['second']);

    act(() => toast.dismiss(first));
    // It left the screen when it was pushed back; it has no exit to play now.
    expect(result.current.toasts.map((t) => t.message)).toEqual(['second']);
  });

  it('is not drawn again when the overflow drops it', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, maxPending: 1, exitDuration: EXIT }));
    act(() => {
      toast('t0', { duration: 60_000 });
    });
    act(() => {
      toast.error('t1', { duration: 60_000 });
    });
    advance(EXIT + 50);
    act(() => {
      toast('t2', { duration: 60_000 });
    });
    expect(getState().toasts.find((t) => t.message === 't0')?.dismissReason).toBe('overflow');
    expect(result.current.toasts.some((t) => t.message === 't0')).toBe(false);
  });

  it('keeps its progress while it waits', () => {
    render(<Toaster visibleToasts={1} />);
    let upload!: ReturnType<typeof toast.progress>;
    let other = '';
    act(() => {
      upload = toast.progress('Uploading');
    });
    upload.set(0.6);
    act(() => {
      // An error goes ahead and pushes the upload back into the queue.
      other = toast.error('Something else', { duration: 60_000 });
    });
    advance(1000);
    act(() => toast.dismiss(other));
    advance(1000);
    expect(progressValue(upload.id).value).toBeCloseTo(0.6);
  });

  it('gets no pause credit for time it spent waiting', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, exitDuration: EXIT }));
    let front = '';
    act(() => {
      front = toast('front', { duration: Infinity });
    });
    act(() => {
      toast('waiting', { duration: 2000 });
    });
    act(() => result.current.startPause());
    advance(10_000);
    act(() => result.current.endPause());
    act(() => toast.dismiss(front));
    const waiting = () => getState().toasts.find((t) => t.message === 'waiting')!;
    advance(deadline(2000) + 50);
    // Its two seconds count from when it came back, and the pause it sat out
    // behind the others is not added to them.
    expect(waiting().dismissed).toBe(true);
  });
});

describe('a toast that arrives during a pause', () => {
  it('is credited only the part of the pause it was on screen for', () => {
    const { result } = renderHook(() => useToaster({ exitDuration: EXIT }));
    act(() => result.current.startPause());
    advance(5000);
    act(() => {
      toast('late', { duration: 2000 });
    });
    advance(1000);
    act(() => result.current.endPause());
    const late = () => getState().toasts.find((t) => t.message === 'late')!;
    // On screen for one second of the pause, so its deadline moves by one
    // second, not by the six the pause lasted.
    advance(deadline(2000) - 50);
    expect(late().dismissed).toBe(false);
    advance(100);
    expect(late().dismissed).toBe(true);
  });
});

describe('pausing from more than one place', () => {
  it('stays paused until every hold is released', () => {
    const { result } = renderHook(() => useToaster());
    act(() => {
      toast('held', { duration: 2000 });
    });
    // An expanded toast holds the queue, and then another toast is pressed.
    act(() => result.current.startPause());
    act(() => result.current.startPause());
    act(() => result.current.endPause());
    expect(result.current.paused).toBe(true);
    act(() => result.current.endPause());
    expect(result.current.paused).toBe(false);
  });

  it('stays paused under the paused option when a press ends', () => {
    const { result } = renderHook(() => useToaster({ paused: true }));
    act(() => result.current.startPause());
    act(() => result.current.endPause());
    expect(result.current.paused).toBe(true);
  });

  it('lets go when a pressed toast leaves before the finger lifts', () => {
    render(<Toaster />);
    let pressed = '';
    act(() => {
      pressed = toast('Pressed', { duration: 60_000 });
    });
    fireEvent(screen.getByText('Pressed'), 'pressIn');
    expect(getState().pausedAt).not.toBeUndefined();
    act(() => toast.dismiss(pressed));
    advance(1000);
    expect(screen.queryByText('Pressed')).toBeNull();
    expect(getState().pausedAt).toBeUndefined();
  });

  it('keeps the time the pause began when a second hold starts', () => {
    dispatch({ type: ActionType.START_PAUSE, time: 1000 });
    dispatch({ type: ActionType.START_PAUSE, time: 4000 });
    expect(getState().pausedAt).toBe(1000);
  });
});

describe('slots', () => {
  it('a banner keeps its place when a burst fills the toasts at its position', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 3, exitDuration: EXIT }));
    act(() => {
      toast.banner('Offline', { duration: Infinity });
    });
    act(() => {
      for (let n = 0; n < 3; n++) toast(`t${n}`, { duration: 60_000 });
    });
    const offline = result.current.toasts.find((t) => t.message === 'Offline');
    expect(offline?.queued).toBeFalsy();
    expect(result.current.pending.some((t) => t.message === 'Offline')).toBe(false);
  });

  it('the overflow drops from the crowded position, not from another one', () => {
    renderHook(() => useToaster({ visibleToasts: 3, maxPending: 10, exitDuration: EXIT }));
    act(() => {
      toast('Saved', { position: 'bottom-center', duration: Infinity });
    });
    act(() => {
      for (let n = 0; n < 13; n++) toast(`t${n}`, { duration: 60_000 });
    });
    expect(getState().toasts.find((t) => t.message === 'Saved')?.dismissed).toBe(false);
  });
});

describe('first come, first shown', () => {
  it('a toast brought back by id waits behind the one that moved up', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 1, exitDuration: EXIT }));
    act(() => {
      toast('A', { id: 'a', duration: 60_000 });
      toast('B', { duration: 60_000 });
    });
    act(() => toast.dismiss('a'));
    act(() => {
      toast('A again', { id: 'a', duration: 60_000 });
    });
    // B keeps the place it moved up into; A, news again, waits its turn.
    const showing = result.current.toasts.filter((t) => !t.dismissed && !t.queued).map((t) => t.message);
    expect(showing).toEqual(['B']);
    expect(result.current.pending.map((t) => t.message)).toEqual(['A again']);
  });

  it('spreads out deadlines that meet after a pause', () => {
    const { result } = renderHook(() => useToaster({ visibleToasts: 3, exitDuration: EXIT }));
    act(() => {
      toast('A', { duration: 4000 });
    });
    advance(1000);
    act(() => result.current.startPause());
    advance(2000);
    act(() => result.current.endPause());
    advance(1000);
    act(() => {
      toast('B', { duration: 2000 });
    });
    // A leaves at 4000 + 2000 paused - enter; B would leave on the same frame.
    const gone = () => getState().toasts.filter((t) => t.dismissed).map((t) => t.message);
    advance(deadline(2000) + 50);
    expect(gone()).toEqual(['A']);
    advance(defaultMotion.stagger);
    expect(gone()).toEqual(['B', 'A']);
  });

  it('spreads out a promise outcome and a toast shown with it', () => {
    renderHook(() => useToaster({ visibleToasts: 3, exitDuration: EXIT }));
    act(() => {
      toast.loading('Saving', { id: 'save' });
    });
    advance(3000);
    act(() => {
      toast.success('Saved', { id: 'save', duration: 2000 });
      toast('Synced', { duration: 2000 });
    });
    const gone = () => getState().toasts.filter((t) => t.dismissed).map((t) => t.message);
    advance(deadline(2000) + 50);
    expect(gone()).toEqual(['Saved']);
    advance(defaultMotion.stagger);
    expect(gone()).toEqual(['Synced', 'Saved']);
  });
});

describe('toast.update', () => {
  it('gives a toast whose type changes the new type\'s full time', () => {
    renderHook(() => useToaster({ exitDuration: EXIT }));
    let id = '';
    act(() => {
      id = toast.loading('Saving');
    });
    advance(5000);
    act(() => toast.update(id, { type: 'success', message: 'Saved' }));
    advance(deadline(2000) - 50);
    expect(getState().toasts.find((t) => t.id === id)!.dismissed).toBe(false);
    advance(100);
    expect(getState().toasts.find((t) => t.id === id)!.dismissed).toBe(true);
  });
});

describe('removal', () => {
  it('does not remove a toast that came back before its removal ran', () => {
    renderHook(() => useToaster({ exitDuration: EXIT }));
    act(() => {
      toast.loading('Saving', { id: 'save' });
    });
    act(() => toast.dismiss('save'));
    act(() => {
      jest.advanceTimersByTime(EXIT - 10);
      // The outcome lands in the same frame the removal fires.
      toast.success('Saved', { id: 'save' });
      jest.advanceTimersByTime(20);
    });
    expect(getState().toasts.find((t) => t.id === 'save')?.message).toBe('Saved');
  });
});

describe('two Toasters on one region', () => {
  it('keeps the region alive while one of them is still mounted', () => {
    const first = render(<Toaster />);
    const second = render(<Toaster />);
    act(() => {
      toast('before', { duration: 60_000 });
    });
    first.unmount();
    act(() => {
      toast('after', { duration: 60_000 });
    });
    expect(second.getByText('after')).toBeTruthy();
  });
});

describe('dedupe', () => {
  it('keeps absorbing repeats a little apart, and gives the toast its time after the last', () => {
    const { result } = renderHook(() => useToaster({ exitDuration: EXIT }));
    for (let n = 0; n < 6; n++) {
      act(() => {
        toast.error('No connection', { dedupeKey: 'offline', duration: 2000 });
      });
      advance(600);
    }
    const live = () => getState().toasts.filter((t) => !t.dismissed);
    expect(live()).toHaveLength(1);
    expect(live()[0]!.count).toBe(6);
    // 600ms after the sixth call; it still has its two seconds from that call.
    advance(deadline(2000) - 600 - 50);
    expect(live()).toHaveLength(1);
    advance(100);
    expect(live()).toHaveLength(0);
    expect(result.current.toasts.length).toBeGreaterThan(0);
  });
});

describe('toast.promise', () => {
  it('drops what only the loading state asked for when the outcome lands', async () => {
    renderHook(() => useToaster({ exitDuration: EXIT }));
    let settle!: () => void;
    let id = '';
    await act(async () => {
      void toast.promise(new Promise<void>((resolve) => (settle = resolve)), { loading: 'Uploading', success: 'Uploaded' }, {
        position: 'bottom-center',
        loading: { description: '2 of 4 files', id: 'up' },
      });
      id = 'up';
    });
    expect(getState().toasts.find((t) => t.id === id)!.description).toBe('2 of 4 files');
    await act(async () => {
      settle();
    });
    const outcome = getState().toasts.find((t) => t.id === id)!;
    expect(outcome.message).toBe('Uploaded');
    expect(outcome.description).toBeUndefined();
    // Shared options stay.
    expect(outcome.position).toBe('bottom-center');
  });
});
