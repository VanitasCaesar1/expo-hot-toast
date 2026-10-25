import './live.css';
import { useState } from 'react';
import { GlassButton } from '../glassyui/glass-button';
import { LiveCode } from './code';
import { withToast } from '../../lib/live';

type Fire = Parameters<typeof withToast>[0];

interface Example {
  id: string;
  emoji: string;
  label: string;
  code: string;
  fire: Fire;
}

const wait = (ms: number, fail = false) =>
  new Promise<void>((resolve, reject) => setTimeout(() => (fail ? reject(new Error('failed')) : resolve()), ms));

let saves = 0;

const examples: Example[] = [
  {
    id: 'success',
    emoji: '✅',
    label: 'Success',
    code: `toast.success('Changes saved');`,
    fire: (toast) => toast.success('Changes saved'),
  },
  {
    id: 'error',
    emoji: '❌',
    label: 'Error',
    code: `toast.error('Could not reach the server');`,
    fire: (toast) => toast.error('Could not reach the server'),
  },
  {
    id: 'promise',
    emoji: '⏳',
    label: 'Promise',
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
    emoji: '📝',
    label: 'Description',
    code: `toast.error('Could not upload photo', {
  description: 'Check your connection and try again.',
});`,
    fire: (toast) => toast.error('Could not upload photo', { description: 'Check your connection and try again.' }),
  },
  {
    id: 'action',
    emoji: '↩️',
    label: 'Undo action',
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
    emoji: '🎨',
    label: 'Rich colours',
    code: `toast.success('Payment received', { richColors: true });
toast.error('Card declined', { richColors: true });`,
    fire: (toast) => {
      toast.success('Payment received', { richColors: true });
      setTimeout(() => toast.error('Card declined', { richColors: true }), 450);
    },
  },
  {
    id: 'emoji',
    emoji: '👏',
    label: 'Emoji',
    code: `toast('Good job!', { icon: '👏' });`,
    fire: (toast) => toast('Good job!', { icon: '👏' }),
  },
  {
    id: 'tint',
    emoji: '🫧',
    label: 'Tinted glass',
    code: `toast('Hot out of the toaster', {
  icon: '🔥',
  glass: { tintColor: 'rgba(255,140,40,0.35)' },
});`,
    fire: (toast) => toast('Hot out of the toaster', { icon: '🔥', glass: { tintColor: 'rgba(255,140,40,0.35)' } }),
  },
  {
    id: 'loading',
    emoji: '🔄',
    label: 'Loading',
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
    emoji: '🧺',
    label: 'Deduplicated',
    code: `// Tap it again and again: still one toast.
toast.success('Draft saved', { dedupeKey: 'draft' });`,
    fire: (toast) => toast.success('Draft saved', { dedupeKey: 'draft' }),
  },
  {
    id: 'close',
    emoji: '✖️',
    label: 'Close button',
    code: `toast('Sync paused until you reconnect', {
  closeButton: true,
  duration: Infinity,
});`,
    fire: (toast) => toast('Sync paused until you reconnect', { closeButton: true, duration: Infinity }),
  },
  {
    id: 'jsx',
    emoji: '🔩',
    label: 'Custom content',
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
      <div className="example-grid" role="group" aria-label="Fire a toast">
        {examples.map((example) => (
          <GlassButton
            key={example.id}
            variant={example.id === current.id ? 'prominent' : 'soft'}
            size="md"
            className="example-button"
            aria-pressed={example.id === current.id}
            onClick={() => {
              setCurrent(example);
              withToast(example.fire);
            }}
          >
            <span aria-hidden="true" className="example-emoji">
              {example.emoji}
            </span>
            {example.label}
          </GlassButton>
        ))}
      </div>
      <LiveCode code={current.code} file={current.label} />
    </div>
  );
}
