# Competitive landscape — React Native / Expo toasts

Research date: October 2026. Purpose: find what `expo-hot-toast` is missing and
match ecosystem conventions instead of inventing our own.

## Libraries surveyed

| Library | Signal | Status |
|---|---|---|
| **sonner-native** | — | Most mature RN port. Real queue semantics, per-channel Toasters, ~30 modules of edge cases. Study `toast-store.ts` + `toaster.tsx`. |
| **@lucaleukert/expo-toast** | 0 stars | Ignored by everyone, yet the most conceptually advanced toast on iOS: promotion queue, drop policy, dedupe-by-key, stack-depth stagger, in-place morphing, velocity-scaled exit, keyboard-curve matching. Swift/SwiftUI today. |
| **react-native-toast-message** (Shift-E) | 28k/wk | The incumbent. Study for what to avoid; its 2px pan dead-zone (issue #113) is the correct pan-vs-tap fix and worth porting to RNGH. |
| **react-native-snackbar** | 867★, 28k/wk | Rewritten as a TurboModule. Has shipped `DISMISS_EVENT_*` constants since 2016 — the ecosystem's acknowledgement that **a dismiss reason is part of the API**. Only library with `rtl` and Android-asset `fontFamily`. |
| **sonner** (web) | — | Read for three mechanics only: soft `visibleToasts` limit, `style.height='auto'` re-measure trick, and `TIME_BEFORE_UNMOUNT` + `offsetBeforeRemove` (capture the offset *before* recomputing siblings). |
| **@gorhom/portal** based toasts | — | Portal primitive rather than a toast library. |

Everything else matching "react native toast" is unmaintained or abandoned.

## Ideas worth taking

1. **Two-tier visible/pending queue.** `toastLimit: 20` is rht's number and it is
   wrong — 20 simultaneous toasts is a wall of glass. Split into
   `visibleToasts` (default 3) + `pendingToasts` (default 10). Overflow either
   collapses behind the front toast keeping timers alive (sonner's soft limit) or
   sits pending and is *promoted* on dismissal (expo-toast, with
   `dropPolicy: 'oldest' | 'newest'`).
2. **Stagger auto-dismiss by stack depth** — `min(depth * 320, 900)` ms added to
   each deadline. Without it a stack collapses in a single frame and reads as a
   glitch.
3. **Dismiss reason as a value**, not a boolean: `'timeout' | 'swipe' | 'tap' |
   'close' | 'action' | 'overflow' | 'programmatic'`, plus `onDismiss` /
   `onAutoClose` callbacks.
4. **Charge the enter animation to the animation.** sonner-native arms its timer
   at `ENTER + duration`. Ours charges the 350ms entrance to reading time, so a
   2000ms success toast is readable for 1650ms.
5. **Action button** (`action?: { label, onPress }`), plus an in-place
   `transition(id, …)` that morphs content rather than dismissing and re-showing.
   Our `promise` already reuses the id; it just re-renders instead of morphing.
6. **`dedupeKey` + `dedupeWindowMs`**, with `show()` returning the existing id so
   the caller can `transition()` it instead of stacking duplicates. Cheapest
   possible fix for a spinner firing 20×/sec. Bounded LRU (expo-toast caps at
   500). Absent from every JS toast library.
7. **Symbolic durations** `'short' | 'long' | 'infinite'` — snackbar and
   expo-toast converged on this independently.
8. **`important` → assertive announcement.** *We already compute this flag and
   then throw it away.*
9. **Re-measure height when content changes** (sonner's `height: 'auto'` trick).
   Our `onLayout`-only ref means a toast that grows from two lines to four keeps
   its old exit travel and exits the wrong distance.
10. **`FullWindowOverlay`** on iOS via `react-native-screens`, so toasts appear
    above native-stack screens, bottom tabs and presented sheets. Plus
    `elevation: 9999` **on Android only** — without it the positioner renders
    behind sibling screens and toasts vanish.
11. **Velocity-scaled exit + elastic resistance** on wrong-direction drags.
    `velocityScale = min(|vy| / 1800, 0, 1)`, duration `0.22 - 0.1 * scale`.
12. **Match the keyboard's own duration and curve.** Reading
    `keyboardAnimationDurationUserInfoKey` and
    `keyboardAnimationCurveUserInfoKey` instead of snapping to the final height,
    with `extraLift = max(0, overlap - safeAreaInsets.bottom)` so a toast with a
    34pt inset isn't over-lifted.

## Conventions to match

| Convention | We |
|---|---|
| `toast()` + `.success/.error/.loading/.promise/.dismiss()` | ✅ |
| `<Toaster />` holds config, `toast()` fires from anywhere | ✅ |
| Per-type `toastOptions={{ success: {...} }}` | ✅ |
| `duration: number \| 'short' \| 'long' \| 'infinite'` | ❌ numbers only |
| **`visibleToasts`**, default 3 (not `toastLimit: 20`) | ❌ |
| **`gap`**, default 14 (not `gutter: 10`) | ⚠️ |
| **`closeButton`**, default `false` | ⚠️ named `closeable` |
| **Dismiss reason as an event value** | ❌ boolean |
| `onDismiss` / `onAutoClose` | ❌ |
| `pauseWhenPageIsHidden` | ⚠️ partial |
| `important` → assertive | ❌ computed then discarded |
| `borderCurve: 'continuous'` | ❌ |
| `allowFontScaling` / `maxFontSizeMultiplier` | ❌ |
| Animated overflow, never `Array.slice` | ✅ ahead of rht |
| Never animate opacity on glass | ✅ |

**Renames worth making for zero cost:** `gutter` → `gap`, `toastLimit` →
`visibleToasts` (keeping the old names as deprecated aliases), `closeable` →
`closeButton`. `visibleToasts` in particular communicates the collapse semantics
rather than a hard cap.

## Adopted (and where)

Implemented from this research:
- Soft `visibleToasts` cap with implicit promotion + `maxPending` / `dropPolicy`
- Stagger by stack depth (`320ms`, capped `900ms`)
- Enter animation charged to the animation, not the reader
- Time measured from first-visible, not creation, so promoted toasts get a full duration
- Dismiss reason as a typed value + `onDismiss`
- `dedupeKey` / `dedupeWindowMs`, bounded registry, returns the live id
- Symbolic durations `'short' | 'long' | 'infinite'`
- Action button, dismissed with `reason: 'action'` after the handler runs
- `important` → assertive live region (this one was a real bug: the flag was
  computed at the call site and discarded by `announce()`)
- Velocity-scaled exit, elastic resistance on a wrong-direction drag
- Keyboard inset netted against the safe-area inset, so the stack is not
  over-lifted
- `borderCurve: 'continuous'` on the surface and the action pill
- Renames: `gap`, `visibleToasts`, `closeButton` (old names kept as aliases)

Deliberately not taken, and why:
- **In-place `transition()` cross-dissolve** via `snapshotView(afterScreenUpdates:)`.
  That is a UIKit primitive. In RN the nearest equivalent is a Reanimated
  `withTiming` on content opacity — which cannot touch the glass, and a
  cross-fade through a translucent material looks wrong rather than smooth.
- **`FullWindowOverlay`.** Correct and worth having, but it adds
  `react-native-screens` as a dependency for a case (toasts over a presented
  sheet) that most apps never hit. Deferred rather than coupled.
- **`height: 'auto'` re-measure trick.** Sonner needs it because the web reports
  `getBoundingClientRect()` only on demand. React Native's `onLayout` already
  re-fires whenever bounds change, so the measured ref stays correct without the
  dance.

## Not coming from JS

`@lucaleukert/expo-toast` is native Swift and does things JS cannot: real
`snapshotView(afterScreenUpdates:)` cross-dissolve transitions, `layer.cornerCurve
= .continuous`, `UIAccessibility.post(notification: .announcement)` gated on
importance. Its *concepts* are all implementable in JS; only the glass is
native-only.

## Sources

Read actual source rather than READMEs wherever possible: `ToastQueue.swift` and
`ToastView.swift` (expo-toast), `toast-store.ts` / `toaster.tsx` (sonner-native),
`NativeSnackbar.ts` (snackbar), `useLayoutEffect` height trick (sonner web).
