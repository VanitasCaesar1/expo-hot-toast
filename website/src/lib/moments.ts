/**
 * The scripted demo in example/App.tsx (useDemo), as moments in the recordings.
 * `at` is seconds into each platform's recording; both recordings start a
 * little before the deep link that plays the script, by a different lead.
 */
export interface Moment {
  id: string;
  code: string;
  note: string;
  at: { ios: number; android: number };
}

// Seconds from the start of the recording to the deep link firing.
const LEAD = { ios: 2.3, android: 1.6 };
const step = (seconds: number) => ({ ios: LEAD.ios + seconds, android: LEAD.android + seconds });

export const moments: Moment[] = [
  {
    id: 'success',
    code: "toast.success('Changes saved')",
    note: 'The check draws itself as the toast lands.',
    at: step(0.5),
  },
  {
    id: 'error',
    code: "toast.error('Could not reach the server')",
    note: 'Errors stack above, newest nearest the edge.',
    at: step(1.4),
  },
  {
    id: 'promise',
    code: `toast.promise(upload(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
})`,
    note: 'One toast, from spinner to outcome, in place.',
    at: step(5.0),
  },
  {
    id: 'action',
    code: `toast('Message archived', {
  action: { label: 'Undo', onPress: restore },
})`,
    note: 'A trailing action, dismissed after it runs.',
    at: step(9.8),
  },
  {
    id: 'queue',
    code: `for (const item of cart) {
  toast(\`\${item} added to cart\`)
}`,
    note: 'Three show at once. The rest wait their turn.',
    at: step(13.7),
  },
  {
    id: 'bottom',
    code: "toast('Message sent', { position: 'bottom-center' })",
    note: 'Any edge, clear of the home indicator.',
    at: step(20.5),
  },
];
