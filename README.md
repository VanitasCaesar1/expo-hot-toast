# expo-hot-toast

[![CI](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ci.yml/badge.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/ci.yml)
[![Android](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/android.yml/badge.svg)](https://github.com/VanitasCaesar1/expo-hot-toast/actions/workflows/android.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

The `react-hot-toast` API for Expo and React Native, drawn with Apple's real
Liquid Glass material on iOS 26 and a designed opaque surface everywhere else.

<!-- SCREENSHOTS -->

```tsx
import { Toaster, toast } from 'expo-hot-toast';

export default function App() {
  return (
    <>
      <YourApp />
      <Toaster />
    </>
  );
}

toast.success('Changes saved');
toast.error('Could not reach the server');
await toast.promise(upload(photo), {
  loading: 'Uploading photo…',
  success: 'Photo uploaded',
  error: 'Upload failed',
});
```

## Features

- **Real Liquid Glass on iOS 26**, through `expo-glass-effect`'s native
  `UIGlassEffect`, with stacked toasts sharing one glass container. No blur
  imitation.
- **A considered fallback.** iOS before 26, Android, web, and anyone with Reduce
  Transparency on get an opaque surface with real colour, border and shadow.
- **The react-hot-toast API you know**: `toast()`, `.success`, `.error`,
  `.loading`, `.custom`, `.promise`, `.dismiss`, `<Toaster />`.
- **A queue, not a pile.** Three toasts per position by default; the rest wait
  and move up as space frees, so nothing expires unseen.
- **Built for touch**: swipe to dismiss with fling velocity, press and hold to
  pause, an optional close button and action button (Undo, Retry).
- **Deduplication** with `dedupeKey`, so a handler firing twenty times shows one
  toast.
- **Accessible by default**: screen-reader announcements, Reduce Motion and
  Reduce Transparency, capped font scaling, and distinct haptics for success
  and error.
- **Safe areas and the keyboard** are handled; toasts never sit under the
  Dynamic Island or behind the keyboard.
- **Themable** through design tokens, with light and dark defaults and a CSS
  variable export for NativeWind or Unistyles.

## Install

Not on npm yet. Install from GitHub; npm builds the package after cloning, which
takes a minute or two:

```sh
npm install github:VanitasCaesar1/expo-hot-toast
```

Then add the peer dependencies:

```sh
npx expo install expo-glass-effect expo-haptics react-native-reanimated \
  react-native-worklets react-native-gesture-handler \
  react-native-safe-area-context react-native-svg
```

Your app needs the Worklets Babel plugin (`react-native-worklets/plugin`, last
in the list) and must be wrapped in
`GestureHandlerRootView` and `SafeAreaProvider`, as for any app using those
libraries. Liquid Glass needs an app built with the iOS 26 SDK (Xcode 26 or
newer) running on iOS 26.

Tested with the versions Expo SDK 57 installs (React Native 0.86, Reanimated
4.5, Worklets 0.10, Gesture Handler 2.32, safe-area-context 5.7); use
`npx expo install` so you get the same set. The peer ranges allow Expo SDK 55+,
React 19 and React Native 0.80+.

## Platform support

| Platform | Surface | Status |
|---|---|---|
| iOS 26+ | Liquid Glass | Verified on the iOS 26.5 simulator |
| iOS before 26 | Opaque | Not yet run |
| Android | Opaque | <!-- ANDROID_STATUS --> |
| Web | Opaque | Not yet run |

## Usage

### Toast types

```tsx
toast('Message archived');                  // plain
toast.success('Changes saved');
toast.error('Could not reach the server');
const id = toast.loading('Syncing…');       // stays until updated or dismissed
toast.success('Synced', { id });            // update it in place
toast.custom(<MyBanner />);                 // your element, no default surface
```

Every call returns the toast's id.

### Promises

```tsx
await toast.promise(
  save(draft),
  {
    loading: 'Saving…',
    success: (result) => `Saved ${result.title}`,
    error: (cause) => `Could not save: ${String(cause)}`,
  },
  { success: { duration: 'short' } },
);
```

`toast.promise` returns the original promise, so `await` still rejects.

### Options

```tsx
toast.error('Upload failed', {
  duration: 'long',                         // 'short' 2s, 'long' 4.5s, 'infinite', or ms
  position: 'bottom-center',
  action: { label: 'Retry', onPress: retry },
  closeButton: true,
  dedupeKey: 'upload',
  onDismiss: (id, reason) => log(reason),   // 'timeout' | 'swipe' | 'tap' | 'close' | 'action' | 'overflow' | 'programmatic'
});
```

| Option | Default | |
|---|---|---|
| `duration` | 4000 (success 2000, loading infinite) | Number of ms, or `'short' \| 'long' \| 'infinite'` |
| `position` | Toaster's `position` | `'top-left' \| 'top-center' \| 'top-right' \| 'bottom-…'` |
| `id` | generated | Reuse an id to update a toast in place |
| `icon` | per type | Any element; `null` hides it |
| `action` | — | `{ label, onPress, color? }`; dismisses after `onPress` runs |
| `closeButton` | `false` | Trailing close button; `closeButtonColor` tints it |
| `dismissOnTap` | `true` on Android, `false` on iOS | Tap the toast to dismiss it |
| `dedupeKey` / `dedupeWindowMs` | — / 1000 | Ignore a repeat while the first is on screen |
| `important` | `true` for errors | Assertive live region on Android; iOS cannot interrupt an announcement |
| `glass` | `true` | `false` forces the opaque surface; or a `GlassConfig` |
| `theme` | — | Per-toast token overrides |
| `style` / `textStyle` / `iconStyle` | — | Style overrides, applied last |
| `accessibilityLabel` | the message text | What screen readers announce; set it when the message is an element |
| `onDismiss` | — | Called with `(id, reason)` once the toast has left |
| `toasterId` | `'default'` | Send the toast to a specific `<Toaster>` |

Dismiss and remove:

```ts
toast.dismiss(id);       // animate out; no id dismisses everything
toast.remove(id);        // remove instantly
toast.dismissAll();
```

### The Toaster

```tsx
<Toaster
  position="top-center"
  visibleToasts={3}
  toastOptions={{
    closeButton: true,                    // every toast in this Toaster…
    success: { duration: 'short' },       // …success toasts…
  }}
/>
toast.success('Saved', { closeButton: false });   // …and this one toast wins
```

| Prop | Default | |
|---|---|---|
| `position` | `'top-center'` | Where toasts without a `position` go |
| `toastOptions` | — | Defaults for every toast, plus per-type buckets (`success`, `error`, `loading`, `blank`, `custom`) |
| `visibleToasts` | 3 | How many show at once per position |
| `maxPending` / `dropPolicy` | 10 / `'oldest'` | Queue size beyond the visible ones, and which end to drop when it overflows |
| `gap` / `offset` | 14 / 16 | Space between toasts, and from the screen edge (added to the safe area) |
| `reverseOrder` | `false` | Newest toast at the far end of the stack |
| `theme` / `colorScheme` | system | Token overrides; force `'light'` or `'dark'` |
| `glass` | `true` | `false` forces the opaque surface; or a `GlassConfig` |
| `panThreshold` | 72 | How far a rightward swipe must travel to dismiss; a fast fling either way also dismisses; 0 disables swiping |
| `paused` | — | Freeze every timer, e.g. while a modal is open |
| `toasterId` | `'default'` | Run several independent Toasters |
| `ContainerComponent` | — | Render inside another component; see below |
| `containerStyle` | — | Style for the full-screen container |
| `children` | — | `({ toast, theme }) => element` to render each toast yourself |

### Above modals and sheets

Native modals cover the rest of the app, toasts included. On iOS, render the
Toaster in `react-native-screens`' `FullWindowOverlay` to keep toasts on top
(`react-native-screens` is not a dependency; install it if you use this):

```tsx
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

<Toaster ContainerComponent={Platform.OS === 'ios' ? FullWindowOverlay : undefined} />
```

### Theming

```tsx
<Toaster
  theme={{
    radius: 14,
    fontSize: 16,
    actionColor: '#FF9500',
    motion: { enter: 300 },
  }}
/>
```

Tokens cover colours, radius, padding, maximum width, shadow, type, icon size,
the action colour, `maxFontSizeMultiplier` and every motion duration and curve.
Light and dark defaults follow the system unless `colorScheme` is set.
`resolveTheme()` gives you the resolved tokens outside a component, and
`toastCssVars()` exports them as CSS custom properties for NativeWind or
Unistyles.

### Custom rendering

Render each toast yourself and keep the queue, timers and gestures:

```tsx
import { resolveValue } from 'expo-hot-toast';

<Toaster>
  {({ toast }) => <MyToast message={resolveValue(toast.message, toast)} type={toast.type} />}
</Toaster>
```

Or go fully headless with `useToaster()`, which returns the visible and pending
toasts for one Toaster plus `startPause` / `endPause`.

## Coming from react-hot-toast

Most code ports by changing the import. The differences:

- `className` and `ariaProps` do not exist; use `style`, `theme` and
  `accessibilityLabel`.
- At most three toasts show per position (`visibleToasts`) instead of twenty;
  the rest queue rather than being dropped.
- `gutter` is `gap` and `toastLimit` is `visibleToasts`; the old names still work.
- `useToaster` takes one options object (`{ toastOptions, toasterId }`) and
  returns `{ toasts, pending, startPause, endPause }`; position offsets come from
  layout, so there is no `calculateOffset` or `updateHeight`.
- `onDismiss`, `action`, `closeButton`, `dedupeKey`, symbolic durations and
  swipe to dismiss are additions.

[`docs/design.md`](./docs/design.md) explains the decisions behind the queue,
the timing and the glass, including the react-hot-toast bugs fixed along the way.

## Known limitations

- Native modals cover toasts unless you use `ContainerComponent` (above).
- No morphing between toasts (`glassEffectID`) or in-place cross-fade: React
  Native has no equivalent that works with glass.
- Android draws an opaque surface; it does not imitate glass.

## Contributing

Issues and pull requests are welcome. [`CONTRIBUTING.md`](./CONTRIBUTING.md)
covers setup, the test gates and how releases work.

## License

MIT
