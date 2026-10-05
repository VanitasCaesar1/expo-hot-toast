#!/usr/bin/env node
/**
 * Asserts the publishable artifact is intact.
 *
 * Unit tests cannot reach any of this: they run against `src/`, while consumers
 * get `lib/`. Every check below corresponds to something that has actually
 * broken during development of this package.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const failures = [];
const fail = (msg) => failures.push(msg);

// `npm pack --json --dry-run` lists exactly what would be published.
const packed = JSON.parse(
  execFileSync('npm', ['pack', '--json', '--dry-run'], { cwd: root, encoding: 'utf8' }),
)[0];
const files = new Set(packed.files.map((f) => f.path));

/* 1. Every path declared in package.json must exist on disk. */
const declared = [
  ['main', pkg.main],
  ['module', pkg.module],
  ['types', pkg.types],
  ['react-native', pkg['react-native']],
  ['source', pkg.source],
  ['exports["."].import.default', pkg.exports?.['.']?.import?.default],
  ['exports["."].require.default', pkg.exports?.['.']?.require?.default],
  ['exports["."].import.types', pkg.exports?.['.']?.import?.types],
  ['exports["."].require.types', pkg.exports?.['.']?.require?.types],
];
for (const [label, rel] of declared) {
  if (rel && !existsSync(join(root, rel))) fail(`package.json "${label}" -> ${rel} does not exist`);
}

/* 2. Those same paths must be present in the tarball. */
for (const [label, rel] of declared) {
  if (!rel) continue;
  const norm = rel.replace(/^\.\//, '');
  if (!files.has(norm)) fail(`"${label}" -> ${rel} is missing from the packed tarball`);
}

/* 3. Test files must never ship.
 *
 * bob's `exclude` only guards the babel (JS) targets. Its typescript target
 * shells out to `tsc --project`, which reads `include` from tsconfig.json — and
 * that includes `__tests__` so `npm run typecheck` covers the suite. Without a
 * separate tsconfig.build.json, 64 declaration files ship. */
const leaks = [...files].filter((f) => /(^|\/)(__tests__|__mocks__)\//.test(f) || /\.test\.[cm]?[jt]sx?$/.test(f));
if (leaks.length) fail(`test files would be published (${leaks.length}): ${leaks.slice(0, 5).join(', ')}`);

/* 4. Both module formats and both declaration trees must be complete. */
for (const required of [
  'lib/commonjs/index.js',
  'lib/module/index.js',
  'lib/typescript/commonjs/index.d.ts',
  'lib/typescript/module/index.d.ts',
]) {
  if (!files.has(required)) fail(`missing from tarball: ${required}`);
}

/* 5. The ESM output must actually be marked as ESM, or Node will parse it as
 * CommonJS and fail on the first `import`. */
try {
  const marker = JSON.parse(readFileSync(join(root, 'lib/module/package.json'), 'utf8'));
  if (marker.type !== 'module') fail(`lib/module/package.json has type=${marker.type}, expected "module"`);
  const cjs = JSON.parse(readFileSync(join(root, 'lib/commonjs/package.json'), 'utf8'));
  if (cjs.type !== 'commonjs') fail(`lib/commonjs/package.json has type=${cjs.type}, expected "commonjs"`);
} catch (e) {
  fail(`could not read lib/*/package.json: ${e.message}`);
}

/* 6. Source must ship: the `react-native` export condition points at it and the
 * sourcemaps reference it. */
if (![...files].some((f) => f.startsWith('src/index.ts'))) {
  fail('src/ is not published, but exports["."]["react-native"] points into it');
}

/* 7. Required files npm includes automatically must still be there. */
for (const f of ['package.json', 'README.md', 'LICENSE']) {
  if (!files.has(f)) fail(`missing from tarball: ${f}`);
}

if (failures.length) {
  console.error('Package integrity check FAILED:\n');
  for (const f of failures) console.error('  x ' + f);
  process.exit(1);
}

console.log(
  `Package integrity OK — ${packed.entryCount} files, ` +
    `${(packed.size / 1024).toFixed(1)} KiB packed, ` +
    `${(packed.unpackedSize / 1024).toFixed(1)} KiB unpacked.`,
);
