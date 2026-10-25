#!/usr/bin/env node
/**
 * Typechecks a plain React web app against the built `expo-hot-toast/web`
 * entry, with React's types and nothing from React Native installed. Proves
 * the `./web` exports map resolves and its declarations stand alone, under
 * `bundler` (Vite, Next.js) and `node16` resolution. Run after `build:web`.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'eht-web-consumer-'));
const modules = join(work, 'node_modules');
mkdirSync(join(modules, '@types'), { recursive: true });
mkdirSync(join(modules, 'expo-hot-toast'), { recursive: true });
for (const name of ['@types/react', '@types/react-dom', 'csstype']) {
  cpSync(join(root, 'node_modules', name), join(modules, name), { recursive: true });
}
cpSync(join(root, 'package.json'), join(modules, 'expo-hot-toast', 'package.json'));
cpSync(join(root, 'lib', 'web'), join(modules, 'expo-hot-toast', 'lib', 'web'), { recursive: true });

writeFileSync(
  join(work, 'app.tsx'),
  `import { Toaster, toast, type ToastOptions } from 'expo-hot-toast/web';

const options: ToastOptions = { style: { borderRadius: 12 }, classNames: { toast: 'rounded-xl' }, duration: 'short' };
toast.success('Saved', options);
const upload = toast.progress('Uploading');
upload.set(0.5);
upload.success('Uploaded');
toast.steps(['One', 'Two']).next();
toast.notify({ title: 'Maya', body: 'Hi', avatar: 'https://example.com/a.png' });
toast.hud('Done');
// @ts-expect-error not an option
toast('x', { notAnOption: true });

export function App() {
  return <Toaster position="bottom-right" preset="material" animation="slide" theme={{ radius: 12 }} />;
}
`,
);

let failed = false;
for (const [moduleResolution, module] of [['bundler', 'esnext'], ['node16', 'node16']]) {
  writeFileSync(
    join(work, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: { strict: true, jsx: 'react-jsx', module, moduleResolution, target: 'es2022', lib: ['dom', 'es2022'], noEmit: true, skipLibCheck: false },
      files: ['app.tsx'],
    }),
  );
  try {
    execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', work], { stdio: 'pipe' });
    console.log(`web consumer: ${moduleResolution} OK`);
  } catch (error) {
    failed = true;
    console.error(`web consumer: ${moduleResolution} FAILED\n${error.stdout?.toString() ?? error}`);
  }
}
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
