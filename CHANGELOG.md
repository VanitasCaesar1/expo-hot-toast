# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release. Not yet published to npm; `main` previously pointed at
`src/index.ts`, which works for Metro consumers but ships no compiled output.

### Added

- **Liquid Glass on iOS 26+** through `expo-glass-effect`, wrapping the genuine
  `UIGlassEffect` / `UIGlassContainerEffect`. Each toast is its own `GlassView`
  nested in a `GlassContainer`, so iOS merges the stack into one continuous
  material that re-flows as the queue changes.
- **Three-rung fallback**: real `UIGlassEffect`; opaque tinted surface on
  iOS < 26 or when `UIDesignRequiresCompatibility=YES`; opaque surface when
  Reduce Transparency is enabled. The availability check alone is insufficient —
  `isLiquidGlassAvailable()` still returns `true` under Reduce Transparency.
- **Soft visible cap** via `visibleToasts` (default 3) with implicit promotion.
  Overflow stays stored with its timer unarmed and is promoted into the freed
  slot on dismissal. Nothing is evicted until `visibleToasts + maxPending` is
  exceeded, and even then the victim plays its exit and reports
  `dismissReason: 'overflow'`.
- **Timing that respects the reader.** Deadline is
  `duration + pauseDuration + stagger - enter`, measured from when a toast became
  *visible* rather than created, so a queued toast that waited longer than its
  own duration is not retired on the tick it is promoted.
- **Symbolic durations** `'short' | 'long' | 'infinite'` (2000 / 4500 / never).
- **Deduplication** via `dedupeKey` + `dedupeWindowMs`. A repeated call returns
  the live id instead of stacking, so a caller can update in place. Bounded to
  500 keys.
- **Typed dismiss reasons** — `'timeout' | 'swipe' | 'tap' | 'close' | 'action' |
  'overflow' | 'programmatic' | 'replaced'` — with `onDismiss`. The first reason
  wins, so a toast that times out and is then swiped reports `timeout`.
- **Action buttons** (`action: { label, onPress }`), dismissed with reason
  `'action'` after the handler runs, so the queue never shows a message
  describing something already undone.
- **Accessibility**: `important` selects an assertive live region; Android gets a
  real `accessibilityLiveRegion`, iOS an imperative announcement.
- **RN affordances** the web version has no concept of: safe-area insets,
  keyboard avoidance with the keyboard's own duration and curve, drag-to-dismiss
  with velocity fling, press-and-hold to freeze the queue, backgrounded-app expiry
  recovery, `borderCurve: 'continuous'`, and Reduce Motion handled as its own
  motion config rather than a skip-animation flag.
- **Design-token theming** with `toastCssVars()` emitting CSS custom properties
  for NativeWind or Unistyles, without making either a dependency.
- **Haptics** via `expo-haptics`, distinct patterns for success and error.
  Loading is silent deliberately — it can sit on screen a long time.
- **Compiled build** (`react-native-builder-bob`): CommonJS, ESM and type
  declarations, with a `react-native` export condition so Metro consumes the
  TypeScript source directly.
- **Headless API** — `useToaster`, `useToasterStore`, and the store primitives —
  for building a custom renderer.

### Changed

- `gutter` → `gap`, `toastLimit` → `visibleToasts`, `closeable` → `closeButton`.
  Old names remain as deprecated aliases.
- Peer requirement raised to `react-native-safe-area-context >=5.10.0`;
  5.0.0 does not compile against React Native 0.86's Yoga.

### Fixed

Upstream `react-hot-toast` v2.6.1 defects, each with a regression test in
`__tests__/store.test.ts`:

- Over-limit toasts were **deleted** rather than dismissed, via
  `.slice(0, toastLimit)` — no exit animation, so the toast a user was reading
  blinked out.
- `toast.promise` could **orphan its loading toast**: it built
  `{ id, ...opts, ...opts.success }`, so `toastOptions.success.id` overrode the
  id and the loading toast was never dismissed. The id is now spread last.
- Timers **leaked and ignored `toasterId`**: the pending-removal map was never
  cleared on unmount, and removal always dispatched to the `'default'` region.
- **Ids collided** — `genId()` was a bare module counter, so two copies of the
  library in one bundle both produced `"1"`. Now time + counter + random.
- `useState` plus a manual listener list **tore under concurrent rendering**.
  Replaced with `useSyncExternalStore`.
- **Reduce Motion was cached forever**, so toggling the OS setting mid-session
  did nothing.
- **Explicit `undefined` shadowed fallbacks** during option resolution. Undefined
  keys are now deleted rather than stored.

### Known limitations

- **The glass stack has never been seen on a device.** Everything assertable
  without hardware is asserted — all three fallback rungs, the `GlassContainer`
  merge, the Reduce Transparency path through the public API — but the animation
  timings and the actual `UIGlassEffect` render are unverified.
  `npx expo run:ios` is additionally blocked by two React Native 0.86 / Xcode 27
  toolchain failures unrelated to this package.
- Not available in React Native and deliberately not faked: `glassEffectID` shape
  morphing, `glassEffectTransition`, `.glass` / `.glassProminent` button styles,
  and automatic label-colour adaptation. Android gets a designed opaque surface,
  not an imitation refraction.
- No in-place `transition()` cross-dissolve. It needs
  `snapshotView(afterScreenUpdates:)`, a UIKit primitive; the nearest RN
  equivalent is an opacity animation that cannot touch the glass, and a
  cross-fade through a translucent material reads as wrong rather than smooth.
- Toasts do not render above a presented sheet (`FullWindowOverlay` is not
  used) — it would add `react-native-screens` as a dependency for a case most
  apps never hit.

[Unreleased]: https://github.com/VanitasCaesar1/expo-hot-toast/compare/v0.1.0...HEAD
