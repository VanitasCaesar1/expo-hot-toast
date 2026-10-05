# expo-hot-toast

`react-hot-toast` for Expo, with real Apple Liquid Glass on iOS 26+.

```tsx
import { Toaster, toast } from 'expo-hot-toast';

<Toaster />

toast.success('Saved');
toast.error('Upload failed');
await toast.promise(save(), {
  loading: 'Saving…',
  success: 'Saved',
  error: 'Could not save',
});
```

## Install

```sh
npx expo install expo-glass-effect expo-haptics react-native-reanimated \
  react-native-gesture-handler react-native-safe-area-context react-native-svg
```

Requires Expo SDK 55+ (SDK 57 recommended), React 19, RN 0.80+.
Add the Reanimated Babel plugin and wrap your app in `GestureHandlerRootView`
and `SafeAreaProvider` — see the Reanimated and Gesture Handler setup docs.

## What's different from the original

### Liquid Glass is real, not a blur approximation

Toasts render through `expo-glass-effect`, which wraps the genuine
`UIGlassEffect` / `UIGlassContainerEffect` classes. It works in Expo Go.

More interesting: each toast is its own `GlassView`, but they are nested in a
`GlassContainer`. iOS then treats the stack as **one continuous material** that
merges and re-flows as the queue reflows — a single glass sheet, not a pile of
cards. The web has no equivalent for this.

This is also why **opacity is never animated on the material**. A Liquid Glass
view stops rendering entirely when its own or an ancestor's opacity reaches zero,
and does not retry. So the bar animates `translateY` and `scale` only, and the
opacity fade is confined to the icon and text *inside* the glass. A material
that flies and shrinks reads as native; one that cross-fades reads as a bug.

### Three-rung fallback, because two is not enough

| Condition | Surface |
|---|---|
| iOS 26+, not opted out, transparency allowed | Real `UIGlassEffect` |
| iOS < 26, or `UIDesignRequiresCompatibility=YES` | Opaque tinted surface |
| Reduce Transparency enabled | Opaque tinted surface |

The third rung is the one people miss: `isLiquidGlassAvailable()` still returns
`true` when a user has turned Reduce Transparency on. Relying on the availability
check alone renders a translucent material to someone who explicitly asked not
to see one. `expo-glass-effect`'s own non-iOS build renders a bare `<View>` with
no effect, so the opaque rung is always drawn with real colour, border and
shadow rather than left blank.

### Theming via design tokens

`style` props work as they do anywhere in RN. On top of that there is a token
layer, and `toastCssVars()` emits it as CSS custom properties for NativeWind or
Unistyles — without making either a dependency:

```tsx
import { toastCssVars } from 'expo-hot-toast';

const vars = toastCssVars();

// Unistyles
const themes = { toast: { vars } };

// NativeWind v4
const toastTheme = { colors: { toast: vars } };
```

`resolveTheme()` is pure and safe outside a component; `useToastTheme()` is the
hook form with automatic light/dark.

### RN affordances the web version has no concept of

Safe-area insets (a top-anchored toast would otherwise sit inside the Dynamic
Island), keyboard avoidance for bottom positions, drag-to-dismiss with velocity
fling, press-and-hold to freeze the queue, backgrounded-app expiry recovery,
`accessibilityLiveRegion` on Android plus imperative announcements on iOS, and
Reduce Motion handled as its own motion config rather than a skip-animation flag
— so a reduced-motion user still gets the dismissal feedback.

Haptics via `expo-haptics`, with distinct patterns for success and error.
Loading is silent deliberately: it can sit on screen for a long time, and a
repeating buzz is worse than none.

## API

`toast` matches `react-hot-toast` exactly, so an existing codebase ports with
search and replace:

```ts
toast(message, options?)   // returns id
toast.success(…)  toast.error(…)
toast.loading(…)           // duration: Infinity
toast.custom(jsx, …)       // no default styling
toast.promise(promise, { loading, success, error }, options?)
toast.dismiss(id?, toasterId?, reason?)   toast.dismissAll(toasterId?, reason?)
toast.remove(id?, toasterId?)            toast.removeAll(toasterId?)
```

`toast()` options: `duration` (number or preset), `position`, `toasterId`,
`style` / `textStyle` / `iconStyle`, `theme`, `glass`, `important`, `closeButton`,
`closeButtonColor`, `dismissOnTap`, `accessibilityLabel`, `action`, `dedupeKey`,
`dedupeWindowMs`, `onDismiss`.

`<Toaster />` props: `position`, `toastOptions`, `reverseOrder`, `gap`, `offset`,
`visibleToasts`, `maxPending`, `dropPolicy`, `toasterId`, `theme`, `colorScheme`,
`glass`, `panThreshold`, `paused`, `containerStyle`, and a render-prop `children`
for a fully custom bar.

Headless access for building your own renderer:

```ts
const { toasts } = useToaster({ toastOptions, toasterId });
```

## Upstream bugs fixed in the port

Each of these is a real defect in `react-hot-toast` v2.6.1, with a regression
test in `__tests__/store.test.ts`:

- **Over-limit toasts were deleted, not dismissed.** `.slice(0, toastLimit)`
  removed the 21st toast from the array, which unmounts it with no exit
  animation — the toast a user is reading blinks out. Now the oldest is marked
  dismissed so it plays its exit.
- **`toast.promise` could orphan its loading toast.** It builds
  `{ id, ...opts, ...opts.success }`, so `toastOptions.success.id` overrides the
  id; the loading toast is then never updated and never dismissed, and spins
  forever. The id is now spread last.
- **Timers leaked and ignored `toasterId`.** The pending-removal map was never
  cleared on unmount, and removal always dispatched to the `'default'` region,
  so delayed removals never fired on any custom `toasterId`.
- **Ids collided.** `genId()` was a bare module counter, so two copies of the
  library in one bundle both produced `"1"`. Now time + counter + random.
- **`useState` + a manual listener list** tore under concurrent rendering.
  Replaced with `useSyncExternalStore`.
- **Reduce Motion was cached forever**, so toggling the OS setting mid-session
  did nothing.
- **Explicit `undefined` shadowed fallbacks** during option resolution.
  Undefined keys are now deleted rather than stored.

### Dismiss reasons

A dismissed toast reports *why*, not just that it happened:

```ts
toast('Saved', { onDismiss: (id, reason) => log(id, reason) });
// 'timeout' | 'swipe' | 'tap' | 'close' | 'overflow' | 'programmatic' | 'replaced'
```

`react-native-snackbar` has shipped `DISMISS_EVENT_*` constants since 2016, so
this is settled ecosystem convention rather than an invention here. It matters:
analytics that cannot distinguish "the user ignored it" from "we evicted it
under load" are measuring the wrong thing. The first reason wins, so a toast that
times out and is then swiped reports `timeout` — the cause that explains it.

### Accessibility

`important` selects an assertive live region; errors are assertive by default.
Android honours this through a real `accessibilityLiveRegion`, and iOS announces
imperatively (`announceForAccessibility`). On iOS the distinction cannot preempt
an announcement already in flight, which is a platform limit rather than a choice.

## Queue: a soft visible cap, not a hard limit

```tsx
<Toaster visibleToasts={3} maxPending={10} dropPolicy="oldest" gap={14} />
```

`react-hot-toast` hardcodes `TOAST_LIMIT = 20` and enforces it with
`Array.slice`, so the 21st toast is deleted from the array outright — no exit
animation, and the toast the user was reading blinks out. Twenty simultaneous
toasts is also a wall of glass rather than a queue.

Here the limit is **soft**. Up to `visibleToasts` are visible *per position*; the
overflow stays stored with its timer **unarmed**, and is promoted into the freed
slot on dismissal. Nothing is evicted until `visibleToasts + maxPending` is
exceeded, at which point `dropPolicy` decides which end to drop — and even then
the victim plays its exit and reports `dismissReason: 'overflow'`.

Promotion is implicit: the visible slice is recomputed from the live list each
render, so removing a toast promotes the next one with no imperative step to
desynchronise.

## Timing that respects the reader

```ts
duration: 2000                        // number, as before
duration: 'short' | 'long' | 'infinite'
```

`'short'` = 2000, `'long'` = 4500, `'infinite'` never expires — snackbar has
exported `LENGTH_SHORT` / `LENGTH_LONG` / `LENGTH_INDEFINITE` for a decade, and
`@lucaleukert/expo-toast` settled on the same names independently.

The deadline is then `duration + pauseDuration + stagger - enter`:

- **`enter` is charged to the animation, not the reader.** Without this a 2000ms
  success toast was on screen for 2000ms but readable for only 1650ms, because
  the 350ms entrance came out of the same budget.
- **`stagger` is added per stack position** (`depth * 320`, capped at 900ms), so
  three toasts shown together retire at 2000 / 2320 / 2640 instead of all
  collapsing on one frame — which reads as a glitch, not three events.
- **Time runs from when a toast became *visible*,** not from creation, so a queued
  toast that waited longer than its own duration is not retired on the tick it is
  promoted.

## Deduplication

```ts
toast('Saving…', { dedupeKey: 'save' });   // fires once
toast('Saving…', { dedupeKey: 'save' });   // returns the SAME id, adds nothing
```

A spinner firing twenty times a second says nothing; one toast that transitions
in place says a lot. No JS toast library has this. Bounded to 500 keys.

## Actions

```tsx
toast.error('Upload failed', { action: { label: 'Retry', onPress: retry } });
```

Dismissed with `reason: 'action'`, after `onPress` runs — so the queue never shows
a message describing something that has already been undone.

## Naming

`gap` (not `gutter`), `visibleToasts` (not `toastLimit`), `closeButton` (not
`closeable`). Both old names still work as deprecated aliases. The research
behind these choices is in [`RESEARCH.md`](./RESEARCH.md).

## Testing

```sh
npm test                 # 284 tests
npm run typecheck
npm run typecheck:example
```

Three gates. The example is typechecked against the library's real public types,
which is what catches a broken API without needing a device.

Two runners, split by what they need. Vitest covers the pure logic — reducer,
option resolution, `toast.promise`, toasterId routing, theme merging — because it
needs no renderer and is an order of magnitude faster. Jest runs on the real
React Native renderer via `jest-expo`, so component tests exercise genuine host
components and real style resolution rather than string stubs.

Reanimated is stubbed in Jest. Its animations are worklets that execute on the UI
thread and never run in a unit test, so there is nothing to simulate; the stub
exists so components mount and keep their host output inspectable. Its shipped
`mock` cannot be used because it imports a TurboModule that does not exist under
Jest.

## Known limitations

Not available in React Native, and deliberately not faked: `glassEffectID`
shape morphing, `glassEffectTransition`, `.glass` / `.glassProminent` button
styles, and automatic label-colour adaptation. Android gets a designed opaque
surface, not an imitation refraction.

- **No build pipeline yet.** `main` points at `src/index.ts`, which is correct
  for an Expo app consuming the package from source, but publishing to npm needs
  a compile step and generated declarations.
- **The glass stack has never been seen on a device.** Everything that can be
  asserted without hardware is asserted — all three fallback rungs, the
  `GlassContainer` merge, the Reduce Transparency path through the public API —
  but the animation timings and the actual `UIGlassEffect` render are unverified.
  The example app exists and `npx expo config` validates, but `expo run:ios` is
  blocked by two React Native 0.86 / Xcode 27 toolchain failures unrelated to
  this package. See `example/README.md`.

## Dependency resolution

`.npmrc` sets `legacy-peer-deps=true`, which looks like a shortcut and is not.
The conflict is unresolvable by any version choice:

| Package | Declares |
|---|---|
| `react-native-reanimated@4.7` | `peer react-native-worklets: "0.13.x"` — **required** |
| `expo-modules-core@57.0.20` | `peerOptional react-native-worklets: "^0.7.4 … ^0.10.0"` — **stale** |

Those ranges do not intersect, and downgrading worklets to satisfy the second
breaks Reanimated outright. The conflict is cosmetic — expo-modules-core only
peers on worklets *optionally*, for its own JSI integration, so 0.13 costs it
nothing — but strict resolution still refuses, which leaves the lockfile
unreproducible and `npm ci` broken. Recording the flag means a fresh clone
installs the tree the tests were written against.

`npm audit --omit=dev` reports **0 vulnerabilities**. The dev tree reports 57
advisories in vitest/esbuild/braces/node-forge transitives whose only offered
fix is `npm audit fix --force`, which would break the pinned Expo/RN toolchain.
They are left in place deliberately.

## License

MIT — see [LICENSE](./LICENSE).
