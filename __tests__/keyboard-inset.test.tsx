import { render, screen, act, cleanup } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Keyboard, Platform } from 'react-native';
import { Toaster } from '../src/components/toaster';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { toast } from '../src/core/toast';

/**
 * What the safe-area mock in jest.setup.js reports.
 *
 * 34 at the bottom is the home-indicator inset on a modern iPhone, and it is the
 * number the keyboard maths turns on.
 */
const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };
const OFFSET = 16;

type KeyboardListener = (event: unknown) => void;

const listeners = new Map<string, KeyboardListener[]>();

/**
 * `Keyboard.addListener` is intercepted rather than fired through the real
 * emitter: the Toaster subscribes on mount and never unsubscribes usefully, and
 * driving the handlers directly is the only way to reach the height without a
 * device.
 */
beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  listeners.clear();
  jest.clearAllMocks();

  jest.spyOn(Keyboard, 'addListener').mockImplementation(
    ((eventName: string, callback: KeyboardListener) => {
      const existing = listeners.get(eventName) ?? [];
      existing.push(callback);
      listeners.set(eventName, existing);
      return { remove: () => {} };
    }) as unknown as typeof Keyboard.addListener,
  );
});

afterEach(() => {
  cleanup();
  __resetStore();
  jest.restoreAllMocks();
});

/** Fires one keyboard event at every handler the Toaster registered for it. */
function emit(eventName: string, event: unknown): void {
  act(() => {
    for (const handler of listeners.get(eventName) ?? []) handler(event);
  });
}

/** The iOS keyboard payload. `screenY` is what tells the Toaster this is iOS. */
const shown = (height: number, duration = 250) => ({
  endCoordinates: { height, screenY: 800 - height },
  duration,
});

const bottomOf = (position: string): number | undefined =>
  flatten(findStack(screen.toJSON(), position)?.props?.style).bottom;

const topOf = (position: string): number | undefined =>
  flatten(findStack(screen.toJSON(), position)?.props?.style).top;

describe('Toaster — keyboard inset', () => {
  it('subscribes to the will-show events on iOS', () => {
    // iOS publishes the keyboard's animation curve on the `will` events, so
    // subscribing to `did` would throw away the only chance to move with it.
    expect(Platform.OS).toBe('ios');
    render(<Toaster position="bottom-center" />);

    expect([...listeners.keys()].sort()).toEqual([
      'keyboardWillHide',
      'keyboardWillShow',
    ]);
  });

  it('anchors to the safe-area inset plus the offset with no keyboard up', () => {
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    expect(bottomOf('bottom-center')).toBe(INSETS.bottom + OFFSET);
  });

  it('lifts the stack by the keyboard height less the inset it replaces', () => {
    const KEYBOARD = 336;
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(KEYBOARD));

    // The keyboard already covers the home indicator. Lifting by the full
    // keyboard height *plus* the inset pushes the stack twice as far as it needs
    // to go, which is the over-lift this arithmetic exists to prevent.
    expect(bottomOf('bottom-center')).toBe(KEYBOARD - INSETS.bottom + OFFSET);
    expect(bottomOf('bottom-center')).not.toBe(KEYBOARD + OFFSET);
  });

  it('falls back to the inset for a keyboard shorter than the inset it replaces', () => {
    // A floating keyboard, or a hardware one: shorter than the 34pt it stands in
    // for. Clamping at zero must leave the inset in place rather than push the
    // stack off the bottom of the screen.
    const KEYBOARD = 20;
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(KEYBOARD));

    expect(bottomOf('bottom-center')).toBe(INSETS.bottom + OFFSET);
    expect(bottomOf('bottom-center')).toBeGreaterThanOrEqual(0);
  });

  it('lands on the inset when the keyboard is exactly as tall as it', () => {
    // The boundary either side of `keyboardInset > 0`. Both branches must land
    // in the same place, or the stack would jump by the inset as the keyboard
    // passed through this height.
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(INSETS.bottom));

    expect(bottomOf('bottom-center')).toBe(INSETS.bottom + OFFSET);
  });

  it('tracks a keyboard that resizes while it is up', () => {
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(300));
    expect(bottomOf('bottom-center')).toBe(300 - INSETS.bottom + OFFSET);

    emit('keyboardWillShow', shown(260));
    expect(bottomOf('bottom-center')).toBe(260 - INSETS.bottom + OFFSET);
  });

  it('restores the inset when the keyboard hides', () => {
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(336));
    expect(bottomOf('bottom-center')).not.toBe(INSETS.bottom + OFFSET);

    emit('keyboardWillHide', { endCoordinates: { height: 0, screenY: 800 }, duration: 250 });
    expect(bottomOf('bottom-center')).toBe(INSETS.bottom + OFFSET);
  });

  it('ignores a hide event that carries no endCoordinates', () => {
    // Not every keyboard implementation populates the payload on hide; treating a
    // missing field as a crash or a NaN offset would strand the stack.
    render(<Toaster position="bottom-center" offset={OFFSET} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(336));
    expect(() => emit('keyboardWillHide', {})).not.toThrow();
    expect(bottomOf('bottom-center')).toBe(INSETS.bottom + OFFSET);
  });

  it('does not move a top-anchored stack when the keyboard comes up', () => {
    // The keyboard occupies the bottom of the screen. Lifting a stack that is
    // already anchored to the top would just shove it into the status bar.
    render(<Toaster position="top-center" offset={OFFSET} />);
    act(() => {
      toast('high');
    });

    emit('keyboardWillShow', shown(336));

    expect(topOf('top-center')).toBe(INSETS.top + OFFSET);
  });

  it('moves every bottom-anchored position, not just the centre one', () => {
    render(
      <>
        <Toaster position="bottom-left" offset={OFFSET} />
        <Toaster position="bottom-right" toasterId="right" offset={OFFSET} />
      </>,
    );
    act(() => {
      toast('left', { position: 'bottom-left' });
      toast('right', { position: 'bottom-right', toasterId: 'right' });
    });

    emit('keyboardWillShow', shown(336));

    expect(bottomOf('bottom-left')).toBe(336 - INSETS.bottom + OFFSET);
    expect(bottomOf('bottom-right')).toBe(336 - INSETS.bottom + OFFSET);
  });

  it('applies the offset on top of whichever inset won', () => {
    // The offset is a design choice about breathing room from the edge, so it has
    // to survive the keyboard path rather than be folded into the clamped inset.
    render(<Toaster position="bottom-center" offset={48} />);
    act(() => {
      toast('low');
    });

    emit('keyboardWillShow', shown(336));
    expect(bottomOf('bottom-center')).toBe(336 - INSETS.bottom + 48);
  });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * The mock insets are module-private to jest.setup.js, so they are restated here
 * as literals: if the mock's numbers move, these tests say so instead of silently
 * passing against a different inset.
 */
function findStack(
  node: unknown,
  position: string,
): { props: Record<string, any> } | null {
  // A fragment of Toasters renders as a sibling array at the root.
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findStack(child, position);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const candidate = node as { props?: Record<string, any>; children?: unknown[] };

  const style = flatten(candidate.props?.style);
  const matches =
    position.startsWith('top')
      ? typeof style.top === 'number' && style.bottom === undefined
      : typeof style.bottom === 'number' && style.top === undefined;

  if (matches && style.position === 'absolute') return candidate as never;

  for (const child of candidate.children ?? []) {
    const found = findStack(child, position);
    if (found) return found;
  }
  return null;
}

function flatten(style: unknown): Record<string, any> {
  if (!style) return {};
  if (!Array.isArray(style)) return style as Record<string, any>;
  return style
    .filter(Boolean)
    .reduce<Record<string, any>>((acc, entry) => Object.assign(acc, flatten(entry)), {});
}
