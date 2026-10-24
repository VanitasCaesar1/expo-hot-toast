# Contributing

Thanks for taking a look. Bug reports with a minimal reproduction are the most
useful thing you can send; pull requests are welcome too.

## Setup

Node 22.12 or newer.

```sh
npm ci          # .npmrc sets legacy-peer-deps; see "Dependency resolution" in README.md
npm test        # vitest (pure logic) + jest (components on the RN renderer)
```

## Before opening a pull request

These are the same gates CI runs:

```sh
npm run typecheck
npm run typecheck:example
npm test
npm run build
npm run verify:package    # the tarball contains what package.json points at
npm run verify:consumer   # a consumer typechecks against the packed tarball
```

A behaviour fix should come with a test that fails without it. Unit tests run
against `src/`, so anything about packaging or exports needs one of the two
`verify:*` scripts instead.

## Running the example

`example/` is a single screen for trying the library on a device or simulator.
See [`example/README.md`](./example/README.md) for the version pins and the
Xcode 27 workarounds it currently needs.

## Scope

The library aims to keep `react-hot-toast`'s API, add what React Native needs,
and use real Liquid Glass where the platform has it. Changes that fake a native
effect in JavaScript are unlikely to be accepted; see "Known limitations" in
the README for what is deliberately left out.
