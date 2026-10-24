# Contributing

Thanks for taking a look. Bug reports with a minimal reproduction are the most
useful thing you can send; pull requests are welcome too. For anything larger
than a fix, open an issue first so we can agree on the shape.

## Setup

Node 22.12 or newer (Vitest 5 requires it; the published package itself only
needs a bundler).

```sh
npm ci      # .npmrc sets legacy-peer-deps; see "Dependency resolution" below
npm test    # vitest (pure logic) + jest (components on the RN renderer)
```

## Before opening a pull request

These are the gates CI runs (CI typechecks the example with `tsc` inside
`example/`, which is what `typecheck:example` does from the root):

```sh
npm run typecheck
npm run typecheck:example
npm test
npm run build
npm run verify:package    # the tarball contains what package.json points at
npm run verify:consumer   # a consumer typechecks against the packed tarball
```

A behaviour fix should come with a test that fails without it. Add a line to
`CHANGELOG.md` under the unreleased version.

## How the tests are split

- **Vitest** covers the pure logic: reducer, option resolution, `toast.promise`,
  routing between Toasters, theme merging. It needs no renderer and is an order
  of magnitude faster. The native peers are aliased to `__mocks__/`.
- **Jest** (`jest-expo`) runs components on the real React Native renderer, so
  they exercise genuine host components and style resolution. Reanimated is
  stubbed: its animations are worklets that never run in a unit test.
- **`verify:consumer`** packs the tarball, installs it into a throwaway project
  and typechecks a consumer under `moduleResolution: bundler` (Metro) and
  `node16` (strictest exports check). Unit tests run against `src/`, while users
  get `lib/`, so this is the only check that the `exports` map and emitted
  `.d.ts` files actually work.
- **The Android workflow** builds the example, runs it on an emulator and drives
  every demo row with Maestro (`example/.maestro/`). It runs for changes to
  `src/`, `example/` or the package files; push to a `ci/*` branch to run it
  before opening a pull request. Screenshots are uploaded as artifacts.

## Running the example

`example/` is a single screen with one row per feature.

```sh
cd example
npm install
npx expo run:ios       # or run:android
```

See [`example/README.md`](./example/README.md) for the version pins and the
Xcode 27 workarounds the iOS build currently needs.

## Build and release

`main` is a compiled CommonJS build, `module` is ESM, `types` is generated, and
the `react-native` export condition points at `src/index.ts` so Metro consumes
the TypeScript source directly, which keeps Reanimated worklets working.
`prepare` runs `bob build`, so installs from GitHub get `lib/` too.

Two things that look like bugs and are not:

- **`bob build` always warns** `The esm option is disabled, but the
  exports['.'].require field is set`. Any library publishing both formats with
  bob 0.43 trips it.
- **Type declarations are emitted twice**, under `lib/typescript/commonjs/` and
  `lib/typescript/module/`, because the two formats need separate declaration
  trees. bob validates the paths and fails the build if they drift.

Releases are published from GitHub: publishing a GitHub release runs
`.github/workflows/release.yml`, which runs the gates and publishes to npm with
provenance. It uses npm trusted publishing, so the package must be linked to
this repository on npmjs.com first.

## Dependency resolution

`.npmrc` sets `legacy-peer-deps=true`, which looks like a shortcut and is not:

| Package | Declares |
|---|---|
| `react-native-reanimated@4.7` | `peer react-native-worklets: "0.13.x"` — required |
| `expo-modules-core@57` (via `expo`) | `peerOptional react-native-worklets: "^0.7.4 … ^0.10.0"` — stale |

The ranges do not intersect, and downgrading worklets breaks Reanimated. The
conflict is cosmetic (expo-modules-core only peers on worklets optionally), but
strict resolution refuses it and `npm ci` fails. The example app has its own
copy of the flag because npm reads `.npmrc` only from the project it runs in.

The package itself has no runtime dependencies, only peers, so
`npm audit --omit=dev` reports nothing. The dev tree reports advisories in the
Expo CLI toolchain whose only offered fix downgrades `expo` to SDK 44; they are
dev-only and left in place.

## Scope

The library keeps `react-hot-toast`'s API, adds what React Native needs, and
uses real Liquid Glass where the platform has it. Changes that fake a native
effect in JavaScript are unlikely to be accepted; see
[`docs/design.md`](./docs/design.md) for what is deliberately left out.
