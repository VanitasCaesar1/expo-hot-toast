#!/usr/bin/env node
/**
 * Typechecks a real consumer against the *packed tarball*.
 *
 * This is the check that matters most and the one least likely to be written by
 * accident. `npm run typecheck` passing proves only that `src/` is internally
 * consistent. It says nothing about whether the `exports` map's `types`
 * conditions resolve, whether the `.d.ts` files were emitted where `main` and
 * `types` claim, or whether a declared entry silently does not exist. All three
 * of those broke while building this package.
 *
 * Runs the consumer under both resolution modes:
 *   - `bundler` — what Metro, webpack and Expo actually use;
 *   - `node16`  — strictest check of the exports map (dual CJS/ESM interop).
 *
 * The native peers are stubbed with `any`-typed declarations instead of being
 * installed. Installing the real Expo/RN tree costs minutes and adds nothing:
 * this check is about *our* declaration resolution, not theirs.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const work = mkdtempSync(join(tmpdir(), 'eht-consumer-'));

/** Peers declared in package.json that must resolve for the .d.ts to load. */
const peers = Object.keys(pkg.peerDependencies ?? {}).filter((p) => !['react', 'react-native'].includes(p));

const CONSUMER = `
import {
  Toaster, ToastBar, toast, useToaster, toastCssVars, mergeTheme,
  defaultTheme, darkTheme, resolveTheme, useToastTheme, announce,
  useReduceMotion, useReduceTransparency, useGlassMode, triggerToastHaptic,
  GlassSurface, ToastIcon, CloseIcon, GLASS_SUPPORTED, DEFAULT_TOASTER_ID,
  REMOVE_DELAY, getState, subscribe, dispatch, dispatchAll, setSettings,
  useToasterStore, resolveValue, useToasterCleanup,
} from 'expo-hot-toast';
import type {
  ToasterProps, ToastOptions, Toast, ToastType, ToastPosition, ToastTheme,
  ToastThemeOverride, DismissReason, DefaultToastOptions, GlassConfig,
  MotionConfig, Renderable, ResolvedTheme, ToastCssVars, GlassMode,
  ToastAPI, ToastHandler, PromiseMessages, UseToasterOptions,
  UseToasterResult, UseToasterCleanupOptions, ToasterState, ToasterSettings,
  Action, ActionType, ToastBarProps, ToastIconKind, ToastIconProps,
  GlassSurfaceMode, GlassSurfaceProps, ResolveThemeOptions, DurationPreset,
  DropPolicy, ToastAction,
} from 'expo-hot-toast';

const id: string = toast('hi');
toast.success('ok', { duration: 2000, position: 'top-center' });
toast.error('bad', { important: true, closeButton: true, dedupeKey: 'k' });
toast.loading('wait');
toast.dismiss(id);
toast.dismissAll(undefined, 'programmatic');
toast.removeAll();

void toast.promise(Promise.resolve(1), {
  loading: 'saving',
  success: (v: number) => \`saved \${v}\`,
  error: (e: unknown) => \`failed: \${String(e)}\`,
});

const preset: DurationPreset = 'short';
const policy: DropPolicy = 'oldest';
const act: ToastAction = { label: 'Retry', onPress: () => {} };

const opts: ToastOptions = {
  duration: preset,
  position: 'bottom-center' as ToastPosition,
  style: { opacity: 1 },
  glass: { enabled: true } as GlassConfig,
  action: act,
  onDismiss: (_i: string, r: DismissReason) => void r,
};
toast('typed', opts);

const rt: ResolvedTheme = resolveTheme({ colorScheme: 'dark' } as ResolveThemeOptions);
const theme: ToastTheme = mergeTheme(defaultTheme, { radius: 12 } as ToastThemeOverride);
const override: ToastThemeOverride = { motion: { enter: 100 } as Partial<MotionConfig> };
const vars: ToastCssVars = toastCssVars();
const node: Renderable = 'x' as unknown as Renderable;

// closeButton and the closeable alias are per-toast, reached through
// toastOptions — there is no top-level Toaster prop for either.
const props: ToasterProps = {
  position: 'top-center',
  visibleToasts: 3,
  gap: 14,
  maxPending: 10,
  dropPolicy: policy,
  reverseOrder: false,
  offset: 12,
  toasterId: 'main',
  panThreshold: 0.3,
  paused: false,
  containerStyle: {},
  toastOptions: { closeButton: true, success: { duration: 2000 } } as DefaultToastOptions,
  glass: true,
  colorScheme: 'dark',
  toastLimit: 3,
  gutter: 10,
};
void [rt, theme, override, vars, node, darkTheme, props];

export function Screen() {
  const { toasts } = useToaster({ toasterId: 'main' } as UseToasterOptions);
  const t: Toast | undefined = toasts[0];
  const type: ToastType | undefined = t?.type;
  const motion: MotionConfig = useToastTheme().motion;
  const rm = useReduceMotion();
  const reduceTransparency = useReduceTransparency();
  const gm: GlassMode = useGlassMode(true);
  const store = useToasterStore();
  useToasterCleanup({ toasterId: 'main' } as UseToasterCleanupOptions);
  announce('hi', true);
  triggerToastHaptic('success');
  void [DEFAULT_TOASTER_ID, REMOVE_DELAY, GLASS_SUPPORTED, getState, subscribe,
       dispatch, dispatchAll, setSettings, resolveValue, Toaster, ToastBar,
       GlassSurface, ToastIcon, CloseIcon, motion, rm, reduceTransparency, gm,
       store, type];
  return null;
}
`;

try {
  /* Pack the tarball and unpack it in place of an install. */
  const tarball = execFileSync('npm', ['pack', '--silent', '--pack-destination', work], {
    cwd: root,
    encoding: 'utf8',
  }).trim().split('\n').pop();

  const consumer = join(work, 'app');
  mkdirSync(join(consumer, 'node_modules'), { recursive: true });
  execFileSync('tar', ['xzf', join(work, tarball), '-C', join(consumer, 'node_modules')], { stdio: 'inherit' });
  cpSync(join(consumer, 'node_modules/package'), join(consumer, 'node_modules/expo-hot-toast'), { recursive: true });
  rmSync(join(consumer, 'node_modules/package'), { recursive: true, force: true });

  /* Reuse the workspace's react/react-native so the JSX and React types are real. */
  for (const dep of ['react', 'react-native', 'typescript']) {
    const from = join(root, 'node_modules', dep);
    if (existsSync(from)) cpSync(from, join(consumer, 'node_modules', dep), { recursive: true, dereference: true });
  }

  /* Stub the remaining peers with `any` so declaration resolution can proceed. */
  for (const p of peers) {
    const dir = join(consumer, 'node_modules', p);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: p, version: '0.0.0-stub', main: 'index.js', types: 'index.d.ts' }));
    writeFileSync(join(dir, 'index.d.ts'), 'declare const _x: any;\nexport = _x;\n');
    writeFileSync(join(dir, 'index.js'), 'module.exports = {};\n');
  }

  writeFileSync(join(consumer, 'app.tsx'), CONSUMER);

  const base = {
    target: 'ESNext',
    lib: ['ESNext', 'DOM'],
    jsx: 'react-jsx',
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: [],
  };

  let failed = false;
  for (const [label, mod, modRes] of [
    ['bundler (Metro / webpack / Expo)', 'ESNext', 'bundler'],
    ['node16 (strictest exports check)', 'node16', 'node16'],
  ]) {
    const cfg = join(consumer, `tsconfig.${modRes}.json`);
    writeFileSync(cfg, JSON.stringify({ compilerOptions: { ...base, module: mod, moduleResolution: modRes }, include: ['app.tsx'] }, null, 2));
    try {
      execFileSync(join(consumer, 'node_modules/typescript/bin/tsc'), ['--noEmit', '-p', cfg], {
        cwd: consumer,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      console.log(`  ok   consumer typechecks under moduleResolution: ${label}`);
    } catch (e) {
      failed = true;
      console.error(`  FAIL consumer under moduleResolution: ${label}`);
      console.error((e.stdout || '') + (e.stderr || ''));
    }
  }

  if (failed) process.exitCode = 1;
  else console.log('Consumer check OK — the published tarball typechecks for a real user.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
