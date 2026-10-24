/**
 * The scripted demo (playDemo in example/App.tsx), as moments in the clips.
 * `at` is seconds into each platform's trimmed clip; the clips are cut so the
 * long-press that starts the demo sits at LEAD seconds.
 */
export interface Moment {
  id: string;
  tab: string;
  code: string;
  note: string;
  at: { ios: number; android: number };
}

const LEAD = { ios: 0, android: 0 };
const step = (seconds: number) => ({ ios: LEAD.ios + seconds, android: LEAD.android + seconds });

export const moments: Moment[] = [
  {
    id: 'success',
    tab: 'Success',
    code: "toast.success('Changes saved')",
    note: 'Lands with a pop, and the check draws itself.',
    at: step(1.0),
  },
  {
    id: 'error',
    tab: 'Error',
    code: "toast.error('Could not reach the server')",
    note: 'Stacks above, newest nearest the edge. Screen readers hear it first.',
    at: step(1.9),
  },
  {
    id: 'promise',
    tab: 'Promise',
    code: `toast.promise(upload(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
})`,
    note: 'One toast, from spinner to outcome, in place.',
    at: step(5.5),
  },
  {
    id: 'action',
    tab: 'Action',
    code: `toast('Message archived', {
  action: { label: 'Undo', onPress: restore },
})`,
    note: 'A trailing action. The handler runs, then the toast leaves.',
    at: step(10.3),
  },
  {
    id: 'queue',
    tab: 'Queue',
    code: `for (const item of cart) {
  toast(\`\${item} added to cart\`)
}`,
    note: 'Three show at once. The rest wait their turn, then get their full time.',
    at: step(14.2),
  },
  {
    id: 'position',
    tab: 'Position',
    code: "toast('Message sent', { position: 'bottom-center' })",
    note: 'Six positions, clear of the Dynamic Island, home indicator and keyboard.',
    at: step(21.0),
  },
];
