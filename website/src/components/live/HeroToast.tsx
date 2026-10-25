import './live.css';
import { useEffect, useRef } from 'react';
import { GlassButton } from '../glassyui/glass-button';
import { live, withToast } from '../../lib/live';

type Toast = Parameters<Parameters<typeof withToast>[0]>[0];
type Fire = (toast: Toast) => void;

const STAGE = { toasterId: 'stage' };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The hero's stage Toaster: bigger toasts, so the glass reads at a glance. */
const STAGE_TOASTER = {
  position: 'top-center' as const,
  colorScheme: 'dark' as const,
  offset: 28,
  gap: 12,
  theme: {
    fontSize: 17,
    lineHeight: 22,
    iconSize: 24,
    paddingVertical: 16,
    paddingHorizontal: 22,
    radius: 26,
    maxWidth: 460,
    descriptionFontSize: 14,
    descriptionLineHeight: 19,
    frostBlur: 22,
  },
};

/** What the stage plays on its own: a tour of the API, on a loop. */
const reel: Fire[] = [
  (toast) => toast.success('Changes saved', { ...STAGE, duration: 3200 }),
  (toast) => {
    void toast
      .promise(
        wait(1700),
        { loading: 'Uploading photo…', success: 'Photo uploaded', error: 'Upload failed' },
        { ...STAGE, duration: 2600 },
      )
      .catch(() => {});
  },
  (toast) => toast.error('Could not reach the server', { ...STAGE, description: 'Retrying in 5 seconds.', duration: 3600 }),
  (toast) =>
    toast('Message archived', {
      ...STAGE,
      action: { label: 'Undo', onPress: () => toast.success('Restored', STAGE) },
      duration: 3600,
    }),
  (toast) => toast.success('Payment received', { ...STAGE, richColors: true, description: '$24.00 from Maya', duration: 3400 }),
  (toast) => toast('Hot out of the toaster', { ...STAGE, icon: '🔥', glass: { tintColor: 'rgba(255,140,40,0.35)' }, duration: 3200 }),
];

/** What the button serves, one per press. */
const servings: Fire[] = [
  (toast) => toast.success('Here is your toast.', STAGE),
  (toast) => toast('Swipe me away, or press and hold to pause', STAGE),
  (toast) => {
    void toast.promise(wait(1400), { loading: 'Toasting…', success: 'Golden brown', error: 'Burnt' }, STAGE).catch(() => {});
  },
  (toast) => toast.error('Burnt it.', { ...STAGE, description: 'It happens to the best of us.' }),
];

const STEP = 2300;

/**
 * Drives the hero stage: loads the library, gives the stage Toaster its props,
 * and plays the reel while the stage is on screen. A press of the button, or a
 * pointer over the stage, holds the reel so the toasts can be read and touched.
 */
export default function HeroToast() {
  const next = useRef(0);
  const holdUntil = useRef(0);

  useEffect(() => {
    const stage = document.querySelector<HTMLElement>('.stage');
    if (!stage) return undefined;
    let visible = true;
    let hovering = false;
    let step = 0;
    let timer = 0;

    const tick = () => {
      if (visible && !hovering && !document.hidden && Date.now() > holdUntil.current) {
        withToast((toast) => reel[step++ % reel.length](toast));
      }
      timer = window.setTimeout(tick, STEP);
    };

    void live().then(
      (api) => {
        api.configureStage(STAGE_TOASTER);
        timer = window.setTimeout(tick, 500);
      },
      () => {},
    );

    // Off screen, the reel stops and so does the art, which keeps scrolling cheap.
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      stage.toggleAttribute('data-offscreen', !visible);
    });
    seen.observe(stage);
    const enter = () => (hovering = true);
    const leave = () => (hovering = false);
    stage.addEventListener('pointerenter', enter);
    stage.addEventListener('pointerleave', leave);
    return () => {
      clearTimeout(timer);
      seen.disconnect();
      stage.removeEventListener('pointerenter', enter);
      stage.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <GlassButton
      variant="prominent"
      size="lg"
      className="hero-toast"
      onClick={() => {
        holdUntil.current = Date.now() + 5000;
        withToast(servings[next.current % servings.length]);
        next.current += 1;
      }}
    >
      Make me a toast
    </GlassButton>
  );
}
