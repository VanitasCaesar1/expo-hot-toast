import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster, toast } from '../../src/web';
import { __resetStore } from '../../src/core/store';
import { __resetProgress } from '../../src/core/progress';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  __resetStore();
  __resetProgress();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const mount = (props: Parameters<typeof Toaster>[0] = {}) => act(() => root.render(<Toaster {...props} />));
const show = (fire: () => unknown) => act(() => void fire());
const toasts = () => [...container.querySelectorAll<HTMLElement>('.eht-toast')];
const byText = (text: string) => toasts().find((t) => t.textContent?.includes(text));

function pointer(el: Element, type: string, x: number, y: number, timeStamp?: number) {
  const event = new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0 });
  if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  act(() => void el.dispatchEvent(event));
}

describe('expo-hot-toast/web', () => {
  it('renders a toast with its message, description and a live region', () => {
    mount();
    show(() => toast.success('Changes saved', { description: 'All good' }));
    const el = byText('Changes saved')!;
    expect(el).toBeTruthy();
    expect(el.textContent).toContain('All good');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('announces errors assertively', () => {
    mount();
    show(() => toast.error('Payment failed'));
    expect(byText('Payment failed')!.getAttribute('role')).toBe('alert');
  });

  it('dismisses with its exit, then removes the toast', () => {
    vi.useFakeTimers();
    mount();
    let id = '';
    show(() => (id = toast('Bye')));
    show(() => toast.dismiss(id));
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).toBe('leaving');
    for (let i = 0; i < 10; i++) act(() => void vi.advanceTimersByTime(200));
    expect(byText('Bye')).toBeUndefined();
  });

  it('runs an action and then dismisses', () => {
    const onPress = vi.fn();
    mount();
    show(() => toast('Archived', { action: { label: 'Undo', onPress } }));
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Undo')!;
    act(() => button.click());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).toBe('leaving');
  });

  it('writes progress straight to the bar, without re-rendering the toast', () => {
    mount();
    let job!: ReturnType<typeof toast.progress>;
    show(() => (job = toast.progress('Uploading')));
    const fill = container.querySelector<HTMLElement>('.eht-fill')!;
    const before = byText('Uploading')!;
    job.set(0.4);
    expect(fill.style.transform).toBe('scaleX(0.4)');
    expect(container.querySelector('.eht-percent')!.textContent).toBe('40%');
    job.set('indeterminate');
    expect(container.querySelector('.eht-track')!.hasAttribute('data-indeterminate')).toBe(true);
    // The same element: setting progress did not replace the toast.
    expect(byText('Uploading')).toBe(before);
    show(() => job.success('Uploaded'));
    expect(byText('Uploaded')).toBeTruthy();
    expect(container.querySelector('.eht-track')).toBeNull();
  });

  it('opens expandable details', () => {
    mount();
    show(() => toast.error('3 failed', { expandable: { content: 'a.jpg, b.jpg' } }));
    expect(container.textContent).not.toContain('a.jpg, b.jpg');
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Show details"]')!;
    act(() => toggle.click());
    expect(container.textContent).toContain('a.jpg, b.jpg');
    expect(container.querySelector('[aria-label="Hide details"]')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('dismisses a toast swiped right past the threshold', () => {
    const onDismiss = vi.fn();
    mount();
    show(() => toast('Swipe me', { onDismiss }));
    const el = byText('Swipe me')!;
    pointer(el, 'pointerdown', 100, 50, 1000);
    pointer(el, 'pointermove', 130, 50, 1050);
    pointer(el, 'pointermove', 200, 50, 1300);
    pointer(el, 'pointerup', 200, 50, 1320);
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).toBe('leaving');
  });

  it('dismisses a bottom pill flicked down', () => {
    mount({ position: 'bottom-center' });
    show(() => toast('Down'));
    const el = byText('Down')!;
    pointer(el, 'pointerdown', 100, 50, 1000);
    pointer(el, 'pointermove', 100, 70, 1030);
    pointer(el, 'pointermove', 100, 110, 1060);
    pointer(el, 'pointerup', 100, 110, 1070);
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).toBe('leaving');
  });

  it('springs back from a short drag', () => {
    mount();
    show(() => toast('Stay'));
    const el = byText('Stay')!;
    pointer(el, 'pointerdown', 100, 50, 1000);
    pointer(el, 'pointermove', 115, 50, 1200);
    pointer(el, 'pointermove', 130, 50, 1400);
    pointer(el, 'pointerup', 130, 50, 1800);
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).not.toBe('leaving');
  });

  it('swipes a Material snackbar sideways, not down', () => {
    mount({ preset: 'material' });
    show(() => toast('Snack'));
    const el = byText('Snack')!;
    expect(el.getAttribute('data-variant')).toBe('snackbar');
    pointer(el, 'pointerdown', 100, 50, 1000);
    pointer(el, 'pointermove', 100, 80, 1050);
    pointer(el, 'pointermove', 100, 140, 1300);
    pointer(el, 'pointerup', 100, 140, 1320);
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).not.toBe('leaving');
  });

  it('places the Material snackbar at the bottom, full width', () => {
    mount({ preset: 'material' });
    show(() => toast('Snack'));
    expect(container.querySelector('.eht-stack')!.getAttribute('data-position')).toBe('bottom-center');
    expect(byText('Snack')!.style.width).toBe('100%');
  });

  it('flattens React Native style arrays from merged options', () => {
    mount({ toastOptions: { style: { borderRadius: 4 } } });
    show(() => toast('Styled', { style: { color: 'red' } }));
    const el = byText('Styled')!;
    expect(el.style.borderRadius).toBe('4px');
    expect(el.style.color).toBe('red');
  });

  it('applies classNames to each part', () => {
    mount();
    show(() => toast('Classy', { classNames: { toast: 'my-toast', title: 'my-title' } }));
    expect(container.querySelector('.my-toast')).toBeTruthy();
    expect(container.querySelector('.my-title')!.textContent).toBe('Classy');
  });

  it('counts deduplicated repeats', () => {
    mount();
    show(() => toast.error('Offline', { dedupeKey: 'offline' }));
    show(() => toast.error('Offline', { dedupeKey: 'offline' }));
    show(() => toast.error('Offline', { dedupeKey: 'offline' }));
    expect(toasts()).toHaveLength(1);
    expect(container.querySelector('.eht-badge')!.textContent).toBe('×3');
  });

  it('pauses while the mouse is over a toast', () => {
    vi.useFakeTimers();
    mount();
    show(() => toast('Hover', { duration: 1000 }));
    const el = byText('Hover')!;
    act(() => void el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })));
    act(() => void el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })));
    for (let i = 0; i < 10; i++) act(() => void vi.advanceTimersByTime(300));
    expect(container.querySelector('.eht-item')?.getAttribute('data-state')).not.toBe('leaving');
  });

  it('collapses a stacked Toaster, and fans it out under the pointer', () => {
    vi.useFakeTimers();
    mount({ stacked: true });
    show(() => toast('One'));
    show(() => toast('Two'));
    show(() => toast('Three'));
    const items = () => [...container.querySelectorAll<HTMLElement>('.eht-item')];
    // The newest is in front; the two behind are tucked.
    expect(items().map((i) => i.hasAttribute('data-tucked'))).toEqual([false, true, true]);
    expect((items()[2]!.firstElementChild as HTMLElement).style.transform).toContain('scale(0.88)');
    act(() => void items()[0]!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })));
    expect(items().some((i) => i.hasAttribute('data-tucked'))).toBe(false);
    act(() => void items()[0]!.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse' })));
    act(() => void vi.advanceTimersByTime(2600));
    expect(items()[1]!.hasAttribute('data-tucked')).toBe(true);
  });

  it('renders on the server without a window', () => {
    toast('Server');
    expect(() => renderToString(<Toaster />)).not.toThrow();
  });
});
