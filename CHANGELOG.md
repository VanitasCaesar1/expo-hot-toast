# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

Initial release.

### Added

- **Liquid Glass on iOS 26+** through `expo-glass-effect`, wrapping the genuine
  `UIGlassEffect` / `UIGlassContainerEffect`. Each toast is its own `GlassView`,
  and a stack shares one `GlassContainer`, so neighbours blend when they come
  within `containerSpacing` of each other.
- **Three-rung fallback**: real `UIGlassEffect`; opaque tinted surface on
  iOS < 26 or when `UIDesignRequiresCompatibility=YES`; opaque surface when
  Reduce Transparency is enabled. The availability check alone is insufficient —
  `isLiquidGlassAvailable()` still returns `true` under Reduce Transparency.
- **Frosted glass on the web**: a CSS backdrop blur under the translucent
  `background` token, with a lit rim, after Glassy UI's frost. Tuned by
  `frostBlur`, `frostSaturation` and `frostHighlight`; browsers without
  `backdrop-filter`, and anyone who prefers reduced transparency, get the opaque
  surface. `FROST_SUPPORTED` reports whether it is in use.
- **`description`**: a second, quieter line under the message, announced after
  it.
- **`richColors`**: success and error toasts take an outcome palette (fill,
  border, text, and a glass tint), themeable under `theme.rich`.
- **`<Toaster stacked>`**: toasts collapse into a deck behind the newest and fan
  out while pressed. Stays expanded under a screen reader and with
  `reverseOrder`.
- **Swipe toward the edge to dismiss**, as well as sideways.
- **`haptics`** on the Toaster and per toast, to turn the success and error
  haptics off.
- **A toast re-renders only when it changes.** Untouched toasts keep their
  identity through the store, the queue and the Toaster, and the Toaster's
  callbacks and themes are stable, so one toast's update, a new toast, a press
  that pauses the queue, the keyboard, or an equal inline `toastOptions` or
  `theme` re-renders no other toast. Tested in `render-isolation.test.tsx`.
- **Requires Reanimated 4** and `react-native-worklets`, which the code already
  needed; the peer ranges now say so.
- **Rich toasts.** `toast.progress()` returns a controller whose `set()` writes
  to a shared value on the UI thread, so a bar fills without re-rendering;
  `toast.steps()` walks named stages over a segmented bar; `toast.track()`
  wraps a promise that reports progress. `progressStyle: 'ring'` fills a ring
  in place of the icon. Also `expandable` details that hold the queue while
  open, `action.countdown` (a ring draining around Undo), `cancel` beside the
  action, `avatar`, `timestamp`, `onPress`, and a ×N count on deduplicated
  repeats.
- **`info` and `warning` types**, with their own glyphs, rich colours and (for
  warning) haptic.
- **`toast.update(id, changes)`** changes a showing toast's fields and keeps its
  place and timer.
- **Shapes** via `variant`: `pill`, `snackbar`, `card` (`toast.notify()`),
  `banner` (`toast.banner()`, edge to edge), `hud` (`toast.hud()`, centred) and
  `island` (`toast.island()`, in the Dynamic Island).
- **Presets.** `<Toaster preset>`: `auto` (default) draws a Material 3 snackbar
  on Android and the glass pill elsewhere; `glass` or `material` picks one
  everywhere.
- **`<Toaster animation>`**: `hot`, `slide`, `fade`, `pop` or `none`.
- **Customisation**: `<Toaster icons>`; `styles` and `classNames` for each part
  of the toast (for NativeWind and Uniwind); `unstyled`; font, line-limit and
  `fill` tokens; a per-type `haptics` map and named haptics per toast;
  `dismissible` and `swipeDirections`; `icon` as a function of the toast.
- **Theme adapters**: `themeFromColors()` derives a theme from a few semantic
  colours, and `fromNavigationTheme()` from a React Navigation theme.
- **Bold Text** (iOS) steps every weight in the toast up one notch.
- **`expo-hot-toast/web`**: the same toast API, store, queue, presets, rich
  toasts and theme tokens for React DOM apps (Next.js, Vite), drawn with DOM
  and CSS in the same frosted glass. No React Native, React Native Web or
  Reanimated; about 18 KB gzipped. The React Native peers are now optional, so
  a web app installs none of them.
- **Surfaces glide to a new size** when their content changes (a loading toast
  becoming its outcome, details opening, a message updated), on native and the
  web. Reduce Motion keeps the snap.
- **Screen readers**: `toast.steps` reads each step with its place ("Uploading,
  step 2 of 3") and the outcome on its own; a deduplicated toast reads its count.
- **Classes win for the part they style**: a `title` or `description` class
  replaces that part's token text styles, and `unstyled` leaves padding and
  corners to your classes. Checked with Uniwind and Tailwind 4 on Android.
- **`<Toaster blur>`**: pass a blur view (such as expo-blur's `BlurView`, with
  its props) and Android and iOS before 26 draw toasts on a blur instead of the
  opaque surface. No new dependency.
- **Surfaces fade with their content** everywhere but Liquid Glass, which
  cannot fade and dematerializes instead. Before, the text left first and an
  empty frosted or opaque pill shrank away for the rest of the exit.
- **A queue, first come, first shown**: `visibleToasts` (default 3) per
  position. The rest wait their turn with their timers unarmed and move up in
  the order they arrived; errors and `important` toasts go ahead. Banners, the
  HUD and the island have places of their own. Nothing is evicted until `visibleToasts + maxPending` is
  exceeded, and even then the victim plays its exit and reports
  `dismissReason: 'overflow'`.
- **Timing that respects the reader.** Deadline is
  `duration + pauseDuration + stagger - enter`, measured from when a toast became
  *visible* rather than created, so a queued toast that waited longer than its
  own duration is not retired on the tick it is promoted. Pauses (a press, the
  pointer over a toast, an open expandable, `<Toaster paused>`, the app in the
  background) are counted, and the queue resumes when the last lets go.
- **Symbolic durations** `'short' | 'long' | 'infinite'` (2000 / 4500 / never).
- **Deduplication** via `dedupeKey` + `dedupeWindowMs`. A repeated call returns
  the live id instead of stacking, counts itself (×3) and starts the toast's
  time over, so a caller can update in place. Bounded to 500 keys.
- **Typed dismiss reasons** — `'timeout' | 'swipe' | 'tap' | 'close' | 'action' |
  'overflow' | 'programmatic'` — with `onDismiss`. The first reason
  wins, so a toast that times out and is then swiped reports `timeout`.
- **Action buttons** (`action: { label, onPress }`), dismissed with reason
  `'action'` after the handler runs, so the queue never shows a message
  describing something already undone.
- **Accessibility**: Android gets a real `accessibilityLiveRegion` and iOS an
  announcement that waits for VoiceOver to finish, unless the toast is an error
  or `important`. `<Toaster announce={false}>` makes a quiet Toaster for demos.
- **RN affordances** the web version has no concept of: safe-area insets,
  keyboard avoidance for bottom stacks, drag-to-dismiss
  with velocity fling, press-and-hold to freeze the queue, pausing while the app
  is in the background, `borderCurve: 'continuous'`, and Reduce Motion handled as its own
  motion config rather than a skip-animation flag.
- **Design-token theming** with `toastCssVars()` emitting CSS custom properties
  for NativeWind or Unistyles, without making either a dependency.
- **Haptics** via `expo-haptics`: the system's notification patterns for
  success, warning and error, as Apple asks for a task's outcome.
  Loading is silent deliberately — it can sit on screen a long time.
- **Compiled build** (`react-native-builder-bob`): CommonJS, ESM and type
  declarations, with a `react-native` export condition so Metro consumes the
  TypeScript source directly.
- **Headless API** — `useToaster`, `useToasterStore`, and the store primitives —
  for building a custom renderer.
- **`ContainerComponent`** on `<Toaster>`: render inside `FullWindowOverlay` (or
  any wrapper) so toasts stay above native modals and sheets, without making
  `react-native-screens` a dependency.
- **`maxFontSizeMultiplier`** theme token (default 2) caps font scaling, since a
  toast is limited to three lines.
- **`icon: null`** hides a toast's icon, glyph included, as in react-hot-toast.
- From react-hot-toast 2.6: **`iconTheme`** (`primary` colours the built-in
  glyph and spinner), **animated icons** (the icon pops in using the motion
  tokens `iconPop` / `iconPopDelay` / `iconEasing`, which were defined but
  unused; the check draws itself short leg first; the error mark follows the
  circle; none of it under Reduce Motion), a **drop-in `<ToastBar>`** that reads
  its wiring from the Toaster so `<Toaster>{t => <ToastBar toast={t} />}` works,
  **`removeDelay`** (typed before but ignored), and **`handlers`** on
  `useToaster()`.
- **Android CI**: the example is built and driven on an Android emulator with
  Maestro for changes to the library, example or package files, with
  screenshots uploaded.

### Known limitations

- **Verified in CI on the iOS 26.5 simulator and an Android 15 emulator**, not
  yet on physical devices or on iOS before 26. Building the example under
  Xcode 27 needs two toolchain workarounds unrelated to this package (see
  `example/README.md`).
- Not available in React Native and deliberately not faked: `glassEffectID` shape
  morphing, `glassEffectTransition`, `.glass` / `.glassProminent` button styles,
  and automatic label-colour adaptation. Android gets a designed opaque surface,
  not an imitation refraction.
- No in-place `transition()` cross-dissolve. It needs
  `snapshotView(afterScreenUpdates:)`, a UIKit primitive; the nearest RN
  equivalent is an opacity animation that cannot touch the glass, and a
  cross-fade through a translucent material reads as wrong rather than smooth.
- Toasts render above a presented sheet only when the Toaster is given
  `ContainerComponent={FullWindowOverlay}`; it is not the default, so that
  `react-native-screens` stays optional.
