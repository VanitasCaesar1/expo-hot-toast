/**
 * The real library on this page: expo-hot-toast/web, the DOM build, mounted
 * as a page-level Toaster with one more Toaster inside every element marked
 * `data-toast-stage="<id>"` (an empty value means "stage"). It exposes the
 * library's own `toast` on `window.expoHotToast`, which every control on the
 * site calls through lib/live.ts.
 *
 * The site used to load the React Native Web build of the example app for
 * this, a 1.7 MB script. The DOM build draws the same frosted toasts in about
 * 50 KB, from the same source.
 */
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'expo-hot-toast/web';
import type { ToasterProps } from 'expo-hot-toast/web';

export type EmbedConfig = Omit<ToasterProps, 'children'>;

/** A stage's Toaster fills the stage, not the window. */
const IN_STAGE: CSSProperties = { position: 'absolute' };

let scheme: 'light' | 'dark' = 'light';

const examples: Record<string, (options?: Record<string, unknown>) => void> = {
  custom: () =>
    toast.custom((t) => (
      <div
        style={{
          borderRadius: 999,
          padding: '12px 20px',
          background: '#E8590C',
          color: '#fff',
          fontSize: 15,
          fontWeight: 600,
          opacity: t.visible ? 1 : 0,
          transition: 'opacity 200ms',
        }}
      >
        🍞 Toast, served your way
      </div>
    )),
  jsx: () =>
    toast((t) => (
      <span style={{ fontSize: 15, lineHeight: '20px', color: scheme === 'dark' ? '#F2F2F7' : '#1C1C1E' }}>
        Custom and <b>bold</b>{'  '}
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: '#0A84FF', fontWeight: 600, cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </span>
    )),
  // A notification needs its avatar drawn: initials on a colour, as in the app.
  notify: (options) =>
    toast.notify({
      title: 'Maya Patel',
      body: 'Sent you 4 photos from the trip',
      timestamp: 'now',
      avatar: (
        <span style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', background: '#FF9F0A', color: '#fff', fontSize: 15, fontWeight: 700 }}>
          MP
        </span>
      ),
      ...options,
    }),
};

function LiveRoot({ initial }: { initial: EmbedConfig }) {
  const [config, setConfig] = useState<EmbedConfig>(initial);
  const [stageConfigs, setStageConfigs] = useState<Record<string, EmbedConfig>>({});
  const [stages, setStages] = useState<HTMLElement[]>([]);
  scheme = config.colorScheme ?? 'light';

  useEffect(() => {
    window.expoHotToast = {
      toast: toast as never,
      configure: (next) => setConfig((current) => ({ ...current, ...(next as EmbedConfig) })),
      examples,
      configureStage: (next, id = 'stage') =>
        setStageConfigs((current) => ({ ...current, [id]: { ...current[id], ...(next as EmbedConfig) } })),
    };
    setStages([...document.querySelectorAll<HTMLElement>('[data-toast-stage]')]);
    window.dispatchEvent(new Event('expo-hot-toast:ready'));
    return () => {
      delete window.expoHotToast;
    };
  }, []);

  return (
    <>
      <Toaster {...config} />
      {stages.map((element) => {
        const id = element.dataset.toastStage || 'stage';
        return createPortal(<Toaster {...stageConfigs[id]} toasterId={id} containerStyle={IN_STAGE} />, element, id);
      })}
    </>
  );
}

export function mount(element: HTMLElement, config: EmbedConfig): void {
  createRoot(element).render(<LiveRoot initial={config} />);
}
