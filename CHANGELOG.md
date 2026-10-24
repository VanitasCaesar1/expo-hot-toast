# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release. Not yet published to npm; `main` previously pointed at
`src/index.ts`, which works for Metro consumers but ships no compiled output.

### Added

- **Liquid Glass on iOS 26+** through `expo-glass-effect`, wrapping the genuine
  `UIGlassEffect` / `UIGlassContainerEffect`. Each toast is its own `GlassView`,
  and a stack shares one `GlassContainer`, so neighbours blend when they come
  within `containerSpacing` of each other.
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

Found by running the example on an iOS 26.5 simulator:

- `toast.promise` outcomes were timed from when the *loading* toast appeared, so
  a slow request retired its success toast almost as soon as it showed. They now
  get their full duration, and are announced and produce their haptic (an
  id-only seen-set treated the outcome as already shown).
- Toasts without a `position` were counted against `top-center` regardless of
  the Toaster's `position`, skewing the visible cap and stagger.
- `toast.custom` was drawn inside the default glass bar with a stray glyph. It
  now renders the element as-is, like react-hot-toast.
- `<Toaster glass={false}>` had no effect; the setting never reached the surface.
- `<Toaster colorScheme>` forced the tokens but not the glass, so forced-dark
  text could land on light glass.
- Drag-to-dismiss moved the toast vertically under a horizontal finger, jumped
  500px in one frame on release, and called the JS dismiss directly from a
  UI-thread worklet.
- Each toast had its own `GlassContainer`, so nothing could merge; the stack now
  shares one.
- The glass had no corner radius of its own and was clipped square by its
  parent; the opaque rung's shadow was clipped away entirely.
- The enter scale never animated, and on exit an empty glass pill sat on screen
  for the whole exit window before shrinking a second time. Enter and exit now
  run on one clock, and the glass materializes and dematerializes through
  UIKit's effect animation instead of being popped on and off.
- Every toast stretched to `maxWidth` (a `flexGrow` on the message); toasts now
  hug their content, plain toasts no longer reserve an empty icon slot, and
  left/right positions are no longer centred.
- Reanimated warnings for a dependency array and a render-time shared-value read.

### Known limitations

- **Verified on the iOS 26.5 simulator only** — not on a physical device, on
  Android, or on iOS < 26. Building the example under Xcode 27 needs two
  toolchain workarounds unrelated to this package (see `example/README.md`).
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
