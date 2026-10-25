import './live.css';
import { useEffect, useRef } from 'react';
import { GlassButton } from '../glassyui/glass-button';
import { preload, withToast } from '../../lib/live';

type Fire = Parameters<typeof withToast>[0];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Each press serves the next one, so a few presses tour the API. */
const servings: Fire[] = [
  (toast) => toast.success('Here is your toast.'),
  (toast) => toast('Hot out of the toaster', { icon: '🔥' }),
  (toast) => {
    void toast.promise(wait(1400), { loading: 'Toasting…', success: 'Golden brown', error: 'Burnt' });
  },
  (toast) => toast.error('Burnt it.', { description: 'Press and hold a toast to pause it, or swipe it away.' }),
  (toast) => toast('Message archived', { action: { label: 'Undo', onPress: () => toast.success('Restored') } }),
];

export default function HeroToast() {
  const next = useRef(0);
  useEffect(preload, []);
  return (
    <GlassButton
      variant="prominent"
      size="lg"
      className="hero-toast"
      onClick={() => {
        withToast(servings[next.current % servings.length]);
        next.current += 1;
      }}
    >
      <span aria-hidden="true">🍞</span> Make me a toast
    </GlassButton>
  );
}
