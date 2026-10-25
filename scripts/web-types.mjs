#!/usr/bin/env node
/**
 * Points the DOM build's emitted declarations at the web shims.
 *
 * tsc resolves `react-native`, `react-native-reanimated` and
 * `expo-glass-effect` to `src/web/shims` through `tsconfig.web.json`'s paths,
 * but keeps the bare specifiers in the files it writes. A web app has none of
 * those packages, so each import is rewritten to a relative path to the
 * emitted shim declaration.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'web', 'types');
const shims = {
  'react-native': join(root, 'web', 'shims', 'react-native'),
  'react-native-reanimated': join(root, 'web', 'shims', 'reanimated'),
  'expo-glass-effect': join(root, 'web', 'shims', 'expo-glass-effect'),
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.d.ts') ? [path] : [];
  });
}

let rewritten = 0;
for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8');
  const next = source.replace(/(from\s+|import\()(['"])(react-native|react-native-reanimated|expo-glass-effect)\2/g, (_, lead, quote, name) => {
    let rel = relative(dirname(file), shims[name]).split('\\').join('/');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    rewritten += 1;
    return `${lead}${quote}${rel}${quote}`;
  });
  if (next !== source) writeFileSync(file, next);
}
console.log(`web-types: ${rewritten} import${rewritten === 1 ? '' : 's'} pointed at the shims`);
