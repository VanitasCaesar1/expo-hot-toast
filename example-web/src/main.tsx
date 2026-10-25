import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'expo-hot-toast/web';
import type { ToasterPreset, ToastAnimation } from 'expo-hot-toast/web';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function upload() {
  const job = toast.progress('Uploading 4 photos', { description: 'Trip to Lisbon' });
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(p + 0.07 + Math.random() * 0.06, 1);
    job.set(p);
    if (p >= 1) {
      clearInterval(tick);
      job.success('4 photos uploaded', { description: 'Trip to Lisbon' });
    }
  }, 220);
}

function steps() {
  const job = toast.steps(['Compressing video', 'Uploading', 'Processing']);
  setTimeout(() => job.next(), 1300);
  setTimeout(() => job.next(), 2600);
  setTimeout(() => job.success('Video published'), 3900);
}

const rows: Array<[string, string, () => void]> = [
  ['Success', 'toast.success()', () => toast.success('Changes saved')],
  ['Error', 'toast.error()', () => toast.error('Could not reach the server')],
  ['Info', 'toast.info()', () => toast.info('A new version is ready', { description: 'Restart the app to update.' })],
  ['Warning', 'toast.warning()', () => toast.warning('Storage almost full', { description: '2% left on this device.' })],
  ['Promise', 'toast.promise()', () => void toast.promise(wait(1600), { loading: 'Saving…', success: 'Settings saved', error: 'Could not save' })],
  ['Undo action', 'action', () => toast('Message archived', { action: { label: 'Undo', onPress: () => toast.success('Message restored') } })],
  ['Rich colours', 'richColors', () => toast.success('Payment received', { richColors: true })],
  ['Upload with progress', 'toast.progress()', upload],
  ['Steps', 'toast.steps()', steps],
  ['Expandable', 'expandable', () => toast.error('3 photos failed to upload', { duration: 8000, expandable: { content: 'IMG_2041.jpg, IMG_2042.jpg and IMG_2045.jpg are larger than 50 MB.' } })],
  ['Undo countdown', 'action.countdown', () => toast('Conversation deleted', { duration: 6000, action: { label: 'Undo', countdown: true, onPress: () => toast.success('Conversation restored') } })],
  ['Cancel and confirm', 'cancel + action', () => toast('Delete 3 photos?', { duration: 8000, cancel: { label: 'Cancel', onPress: () => {} }, action: { label: 'Delete', color: '#FF3B30', onPress: () => toast.success('3 photos deleted') } })],
  ['Notification', 'toast.notify()', () => toast.notify({ title: 'Maya Patel', body: 'Sent you 4 photos from the trip', timestamp: 'now', avatar: <span style={{ color: '#fff', fontWeight: 700, background: '#FF9F0A', width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>MP</span>, onPress: () => toast.success('Opened the chat') })],
  ['Banner', 'toast.banner()', () => toast.banner("You're offline", { type: 'warning', description: 'Changes will sync when you reconnect.', duration: 6000 })],
  ['HUD', 'toast.hud()', () => toast.hud('Added to Library')],
  ['Island', 'toast.island()', () => toast.island('AirPods Pro connected', { type: 'success' })],
  ['Repeat ×3', 'dedupeKey', () => [0, 1, 2].forEach((i) => setTimeout(() => toast.error('No connection', { dedupeKey: 'offline' }), i * 200))],
  ['Close button', 'closeButton', () => toast('Export started. This can take a minute.', { closeButton: true })],
];

function App() {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [preset, setPreset] = useState<ToasterPreset>('auto');
  const [animation, setAnimation] = useState<ToastAnimation>('hot');
  const dark = scheme === 'dark';
  return (
    <main
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '96px 24px',
        fontFamily: 'system-ui, sans-serif',
        color: dark ? '#f2f2f7' : '#1c1c1e',
        background: dark
          ? 'radial-gradient(60% 50% at 20% 10%, #7a3510, transparent 70%), radial-gradient(50% 50% at 90% 80%, #5a1424, transparent 70%), #111'
          : 'radial-gradient(60% 50% at 20% 10%, #ffcf9e, transparent 70%), radial-gradient(50% 50% at 90% 80%, #ffb3c1, transparent 70%), #faf8f5',
      }}
    >
      <h1 style={{ margin: '0 0 8px' }}>expo-hot-toast/web</h1>
      <p style={{ margin: '0 0 24px', opacity: 0.7 }}>The same API in a plain React DOM app. No React Native.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button data-testid="scheme" onClick={() => setScheme(dark ? 'light' : 'dark')}>{dark ? 'Light' : 'Dark'}</button>
        {(['auto', 'material'] as const).map((p) => (
          <button key={p} data-testid={`preset-${p}`} onClick={() => setPreset(p)} aria-pressed={preset === p}>
            preset {p}
          </button>
        ))}
        {(['hot', 'slide', 'fade', 'pop'] as const).map((a) => (
          <button key={a} onClick={() => setAnimation(a)} aria-pressed={animation === a}>
            {a}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, maxWidth: 960 }}>
        {rows.map(([title, detail, run]) => (
          <button
            key={title}
            data-testid={`row-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
            onClick={run}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, border: 0, background: dark ? '#2c2c2e' : '#fff', color: '#0A84FF', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
          >
            <span>{title}</span>
            <code style={{ opacity: 0.6, color: dark ? '#ddd' : '#555', fontSize: 12 }}>{detail}</code>
          </button>
        ))}
      </div>
      <Toaster colorScheme={scheme} preset={preset} animation={animation} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
