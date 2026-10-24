# Design notes

Why expo-hot-toast behaves the way it does. The README covers how to use it;
this covers the decisions behind it, for contributors and the curious.

## Liquid Glass

Toasts render through `expo-glass-effect`, which wraps the genuine
`UIGlassEffect` / `UIGlassContainerEffect` classes rather than approximating
glass with a blur.

Each toast is its own `GlassView`, and every toast in a stack shares one
`GlassContainer`, so UIKit treats them as one glass group: neighbours blend into
each other when they come within `glass.containerSpacing` (default: the stack
`gap`). At the default gap they read as separate pills. One container per toast
would merge nothing, because UIKit only merges glass views that share one.

**Opacity is never animated on the material.** A Liquid Glass view stops
rendering when its own or an ancestor's opacity reaches zero, and UIKit does not
retry. Instead the glass materializes on enter and dematerializes on exit
through UIKit's own effect animation (`glassEffectStyle` animated to and from
`'none'`), the bar moves with `translateY` and `scale`, and the opacity fade is
confined to the icon and text *inside* the glass.

The material carries its own corner radius. Clipping a square glass view with a
rounded `overflow: hidden` parent cuts off the rim highlight and stops
neighbouring toasts from merging, so nothing above the surface clips.

### The fallback ladder

| Condition | Surface |
|---|---|
| iOS 26+, not opted out, transparency allowed | Real `UIGlassEffect` |
| iOS < 26, or `UIDesignRequiresCompatibility=YES` | Opaque tinted surface |
| Reduce Transparency enabled | Opaque tinted surface |
| Android, web | Opaque tinted surface |
| `glass: false` on the toast or the `<Toaster>` | Opaque tinted surface |

The Reduce Transparency rung is the one people miss: `isLiquidGlassAvailable()`
still returns `true` when a user has turned it on, so relying on the
availability check alone renders a translucent material to someone who asked
not to see one. `expo-glass-effect`'s non-iOS build renders a bare `<View>`, so
the opaque rung is always drawn with real colour, border and shadow rather than
left blank.

Not available in React Native, and deliberately not faked: `glassEffectID`
shape morphing, `glassEffectTransition`, `.glass` / `.glassProminent` button
styles, and automatic label-colour adaptation. There is also no in-place
`transition()` cross-dissolve: it needs `snapshotView(afterScreenUpdates:)`, and
the nearest RN equivalent is an opacity animation that cannot touch the glass.

## Queue: a soft visible cap

`react-hot-toast` hardcodes `TOAST_LIMIT = 20` and enforces it with
`Array.slice`, so the 21st toast is deleted from the array outright — no exit
animation, and the toast the user was reading blinks out. Twenty simultaneous
toasts is also a wall of glass rather than a queue.

Here up to `visibleToasts` (default 3) are visible *per position*; the overflow
stays stored with its timer **unarmed**, and is promoted into the freed slot on
dismissal. Nothing is evicted until `visibleToasts + maxPending` is exceeded, at
which point `dropPolicy` decides which end to drop — and even then the victim
plays its exit and reports `dismissReason: 'overflow'`.

Promotion is implicit: the visible slice is recomputed from the live list each
render, so removing a toast promotes the next one with no imperative step to
desynchronise.

## Timing

A toast's deadline is `duration + pauseDuration + stagger - enter`:

- **`enter` is charged to the animation, not the reader.** Without this a 2000ms
  success toast was on screen for 2000ms but readable for only 1650ms.
- **`stagger` is added per stack position** (`depth * 320`, capped at 900ms), so
  three toasts shown together retire at 2000 / 2320 / 2640 instead of all
  collapsing on one frame, which reads as a glitch.
- **Time runs from when a toast became visible,** not from creation, so a queued
  toast is not retired on the tick it is promoted. A visible toast pushed back
  into the queue by newer ones starts over when it returns.
- **Backgrounded apps recover.** A suspended app freezes timers but not the
  clock, so on resume every visible toast is re-checked against its deadline.

`enter` and `stagger` come from the Toaster's theme, so retuned motion moves the
deadlines with it. Symbolic durations (`'short'` 2000, `'long'` 4500,
`'infinite'`) follow `react-native-snackbar`'s `LENGTH_*` constants.

## Dismiss reasons

`react-native-snackbar` has shipped `DISMISS_EVENT_*` constants since 2016: a
dismiss reason is part of the API. Analytics that cannot tell "the user ignored
it" from "we evicted it under load" measure the wrong thing. The first reason
wins, so a toast that times out and is then swiped reports `timeout`.
`onDismiss` fires once the toast has actually left the screen.

## Deduplication

A duplicate is absorbed only while the earlier toast is still on screen and
inside `dedupeWindowMs`; the call returns that toast's id so the caller can
update it in place. The registry is bounded to 500 keys per Toaster.

## Accessibility

- `important` selects an assertive announcement; errors are assertive by
  default. Android uses `accessibilityLiveRegion`. iOS announces imperatively,
  and cannot preempt an announcement already in flight.
- Reduce Motion gets its own motion config (no travel or scale) rather than a
  skip-animation flag, so the dismissal is still visible.
- Reduce Transparency forces the opaque surface.
- Font scaling is capped by the `maxFontSizeMultiplier` token (default 2),
  because a toast is limited to three lines.
- Haptics: success and error only, with distinct patterns. Loading can sit on
  screen for a long time, and a blank toast carries no outcome worth feeling.

## Upstream bugs fixed in the port

Each was checked against the `react-hot-toast` v2.6.1 source published on npm.
All but the concurrent-rendering one, which is structural, have a regression
test here.

- **Over-limit toasts were deleted, not dismissed** (`.slice(0, toastLimit)`),
  so they unmounted with no exit animation.
- **`toast.promise` could orphan its loading toast.** It builds
  `{ id, ...opts, ...opts.success }`, so `toast.promise(p, msgs, { success: { id } })`
  replaced the loading toast's id and left it spinning. The id is now spread last.
- **Timers leaked and ignored `toasterId`.** The pending-removal map was never
  cleared on unmount, and removal always dispatched to the `'default'` region.
- **Ids collided.** `genId()` was a bare module counter, so two copies of the
  library in one bundle both produced `"1"`. Now time + counter + random.
- **`useState` + a manual listener list** can tear under concurrent rendering
  (upstream carries a TODO to switch). Replaced with `useSyncExternalStore`.
- **Reduce Motion was cached forever** (`prefersReducedMotion` reads
  `matchMedia` once).
- **Explicit `undefined` shadowed fallbacks**, so `toast('x', { icon: undefined })`
  cleared a Toaster-level icon.

## Naming

`gap` (not `gutter`), `visibleToasts` (not `toastLimit`) and `closeButton` (not
`closeable`) follow Sonner and sonner-native. The old names still work as
deprecated aliases. The survey behind these choices is in
[`research.md`](./research.md).
