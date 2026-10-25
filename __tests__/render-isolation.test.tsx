import { render, act, cleanup, fireEvent } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Text } from 'react-native';
import { Toaster } from '../src/components/toaster';
import { ToastBar } from '../src/components/toast-bar';
import { toast } from '../src/core/toast';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';

/**
 * A toast re-renders only when something about it changed. The Toaster used to
 * hand every toast a fresh object, theme and callbacks on every render, so one
 * toast's update re-rendered all of them: harmless at three toasts, a real cost
 * once a progress toast updates many times a second.
 *
 * Renders are counted through the Toaster's render prop, which runs exactly
 * when a toast's slot renders.
 */
let renders: Record<string, number> = {};

// Defined once, as an app would (or wrap it in useCallback): a render prop
// written inline is a new function on every render, and re-renders every toast.
const renderToast = ({ toast: t }: { toast: Parameters<typeof ToastBar>[0]['toast'] }) => {
  renders[String(t.message)] = (renders[String(t.message)] ?? 0) + 1;
  return <ToastBar toast={t} />;
};

function Counted() {
  return <Toaster toastOptions={{ duration: 60000 }}>{renderToast}</Toaster>;
}

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  renders = {};
});

afterEach(() => {
  cleanup();
});

describe('render isolation', () => {
  it('updating one toast leaves the others alone', () => {
    render(<Counted />);
    let first = '';
    act(() => {
      first = toast('first');
      toast('second');
    });
    renders = {};

    act(() => {
      toast('first, updated', { id: first });
    });

    expect(renders['first, updated']).toBeGreaterThan(0);
    expect(renders.second ?? 0).toBe(0);
  });

  it('adding a toast does not re-render the ones already showing', () => {
    render(<Counted />);
    act(() => {
      toast('first');
    });
    renders = {};

    act(() => {
      toast('second');
    });

    expect(renders.second).toBeGreaterThan(0);
    // `first` moves down a slot, so its depth changes and it renders once; it
    // must not render again for the same state.
    expect(renders.first ?? 0).toBeLessThanOrEqual(1);
  });

  it('re-rendering the Toaster with equal inline options re-renders no toast', () => {
    const { rerender } = render(<Counted />);
    act(() => {
      toast('steady');
    });
    renders = {};

    // A new options object with the same contents, as an inline prop gives.
    rerender(<Counted />);

    expect(renders.steady ?? 0).toBe(0);
  });

  it('still re-renders every toast when its theme genuinely changes', () => {
    const { rerender } = render(
      <Toaster theme={{ radius: 10 }}>{({ toast: t }) => <Text>{(renders[String(t.message)] = (renders[String(t.message)] ?? 0) + 1) && String(t.message)}</Text>}</Toaster>,
    );
    act(() => {
      toast('themed');
    });
    renders = {};

    rerender(
      <Toaster theme={{ radius: 20 }}>{({ toast: t }) => <Text>{(renders[String(t.message)] = (renders[String(t.message)] ?? 0) + 1) && String(t.message)}</Text>}</Toaster>,
    );

    expect(renders.themed).toBeGreaterThan(0);
  });
});

describe('render isolation, built-in bar', () => {
  // A function icon is resolved on every render of the built-in bar, so it
  // counts that bar's renders without a render prop in the way.
  const counter = (name: string) => () => {
    renders[name] = (renders[name] ?? 0) + 1;
    return null;
  };

  it('updating one toast leaves the other bars alone', () => {
    render(<Toaster toastOptions={{ duration: 60000 }} />);
    let first = '';
    act(() => {
      first = toast('first', { icon: counter('first') });
      toast('second', { icon: counter('second') });
    });
    renders = {};

    act(() => {
      toast('first, updated', { id: first, icon: counter('first') });
    });

    expect(renders.first).toBeGreaterThan(0);
    expect(renders.second ?? 0).toBe(0);
  });

  it('pressing one toast to pause the queue does not re-render the bars', () => {
    const { getByText } = render(<Toaster toastOptions={{ duration: 60000 }} />);
    act(() => {
      toast('held', { icon: counter('held') });
      toast('other', { icon: counter('other') });
    });
    renders = {};

    // Pausing writes `pausedAt` to the store, which re-renders the Toaster.
    fireEvent(getByText('held'), 'pressIn');

    expect(renders.held ?? 0).toBe(0);
    expect(renders.other ?? 0).toBe(0);
  });
});
