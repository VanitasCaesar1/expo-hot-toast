import './live.css';
import { useState } from 'react';
import { GlassPanel } from '../glassyui/glass-panel';
import { LiveCode } from './code';
import { withToast } from '../../lib/live';

type Fire = Parameters<typeof withToast>[0];

interface Example {
  id: string;
  label: string;
  /** The part of the API it shows, beside its name. */
  api: string;
  code: string;
  fire: Fire;
}

const wait = (ms: number, fail = false) =>
  new Promise<void>((resolve, reject) => setTimeout(() => (fail ? reject(new Error('failed')) : resolve()), ms));

let saves = 0;

const examples: Example[] = [
  {
    id: 'success',
    label: 'Success',
    api: 'toast.success()',
    code: `toast.success('Changes saved');`,
    fire: (toast) => toast.success('Changes saved'),
  },
  {
    id: 'error',
    label: 'Error',
    api: 'toast.error()',
    code: `toast.error('Could not reach the server');`,
    fire: (toast) => toast.error('Could not reach the server'),
  },
  {
    id: 'promise',
    label: 'Promise',
    api: 'toast.promise()',
    code: `toast.promise(saveSettings(settings), {
  loading: 'Saving…',
  success: 'Settings saved',
  error: 'Could not save',
});`,
    // Every third save fails, so both endings show up.
    fire: (toast) => {
      saves += 1;
      void toast
        .promise(wait(1600, saves % 3 === 0), {
          loading: 'Saving…',
          success: 'Settings saved',
          error: 'Could not save',
        })
        .catch(() => {});
    },
  },
  {
    id: 'description',
    label: 'Description',
    api: 'description',
    code: `toast.error('Could not upload photo', {
  description: 'Check your connection and try again.',
});`,
    fire: (toast) => toast.error('Could not upload photo', { description: 'Check your connection and try again.' }),
  },
  {
    id: 'action',
    label: 'Undo action',
    api: 'action',
    code: `toast('Message archived', {
  action: { label: 'Undo', onPress: restore },
});`,
    fire: (toast) =>
      toast('Message archived', {
        action: { label: 'Undo', onPress: () => toast.success('Message restored') },
      }),
  },
  {
    id: 'rich',
    label: 'Rich colours',
    api: 'richColors',
    code: `toast.success('Payment received', { richColors: true });
toast.error('Card declined', { richColors: true });`,
    fire: (toast) => {
      toast.success('Payment received', { richColors: true });
      setTimeout(() => toast.error('Card declined', { richColors: true }), 450);
    },
  },
  {
    id: 'emoji',
    label: 'Custom icon',
    api: 'icon',
    code: `toast('Good job!', { icon: '👏' });`,
    fire: (toast) => toast('Good job!', { icon: '👏' }),
  },
  {
    id: 'tint',
    label: 'Tinted glass',
    api: 'glass.tintColor',
    code: `toast('Hot out of the toaster', {
  icon: '🔥',
  glass: { tintColor: 'rgba(255,140,40,0.35)' },
});`,
    fire: (toast) => toast('Hot out of the toaster', { icon: '🔥', glass: { tintColor: 'rgba(255,140,40,0.35)' } }),
  },
  {
    id: 'loading',
    label: 'Loading',
    api: 'toast.loading()',
    code: `const id = toast.loading('Uploading 3 photos…');
// later, the same toast changes in place:
toast.success('3 photos uploaded', { id });`,
    fire: (toast) => {
      const id = toast.loading('Uploading 3 photos…');
      setTimeout(() => toast.success('3 photos uploaded', { id }), 1800);
    },
  },
  {
    id: 'dedupe',
    label: 'Deduplicated',
    api: 'dedupeKey',
    code: `// Tap it again and again: still one toast.
toast.success('Draft saved', { dedupeKey: 'draft' });`,
    fire: (toast) => toast.success('Draft saved', { dedupeKey: 'draft' }),
  },
  {
    id: 'close',
    label: 'Close button',
    api: 'closeButton',
    code: `toast('Sync paused until you reconnect', {
  closeButton: true,
  duration: Infinity,
});`,
    fire: (toast) => toast('Sync paused until you reconnect', { closeButton: true, duration: Infinity }),
  },
  {
    id: 'jsx',
    label: 'Custom content',
    api: 'toast((t) => …)',
    code: `toast((t) => (
  <Text>
    Custom and <Text style={{ fontWeight: '700' }}>bold</Text>
    <Text onPress={() => toast.dismiss(t.id)}>Dismiss</Text>
  </Text>
));`,
    fire: (_toast, api) => api.examples.jsx?.(),
  },
];

export default function Examples() {
  const [current, setCurrent] = useState(examples[0]);
  return (
    <div className="examples">
      <GlassPanel variant="card" className="example-list">
        <div role="group" aria-label="Fire a toast">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              className="example-row"
              aria-pressed={example.id === current.id}
              onClick={() => {
                setCurrent(example);
                withToast(example.fire);
              }}
            >
              <span className="example-name">{example.label}</span>
              <code className="example-api">{example.api}</code>
            </button>
          ))}
        </div>
      </GlassPanel>
      <LiveCode code={current.code} file={current.label} />
    </div>
  );
}
