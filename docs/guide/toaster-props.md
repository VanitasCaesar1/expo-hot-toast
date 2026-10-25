---
title: Toaster props
description: Every prop the Toaster accepts, with its type and default.
group: Reference
order: 3
---

```tsx
<Toaster position="top-center" visibleToasts={3} />
```

## Placement

| Prop | Type | Default | |
|---|---|---|---|
| `position` | `ToastPosition` | `'top-center'`; `'bottom-center'` with the Material preset | For toasts that do not set one |
| `offset` | `number` | `16` | Distance from the screen edge, added to the safe area |
| `gap` | `number` | `14` | Space between toasts |
| `reverseOrder` | `boolean` | `false` | Newest toast at the far end of the stack |
| `toasterId` | `string` | `'default'` | Run several independent Toasters |
| `ContainerComponent` | component | none | Render inside another component, such as `FullWindowOverlay` |
| `containerStyle` | `ViewStyle` | none | The full-screen container |

## Queue

| Prop | Type | Default | |
|---|---|---|---|
| `visibleToasts` | `number` | `3` | Toasts shown at once per position |
| `maxPending` | `number` | `10` | Toasts that wait beyond the visible ones |
| `dropPolicy` | `'oldest'` or `'newest'` | `'oldest'` | Which toast to drop when the queue is full |
| `paused` | `boolean` | `false` | Freeze every timer |
| `stacked` | `boolean` | `false` | Collapse each stack behind its newest toast; press to fan it out |

## Defaults and appearance

| Prop | Type | Default | |
|---|---|---|---|
| `preset` | `'auto'`, `'glass'` or `'material'` | `'auto'` | The look to start from: a Material 3 snackbar on Android, the glass pill elsewhere; see [Customising](./customizing.md#presets) |
| `animation` | `'hot'`, `'slide'`, `'fade'`, `'pop'` or `'none'` | `'hot'` | How toasts come and go |
| `icons` | `{ success?, error?, info?, warning?, loading?, blank?, close? }` | none | Icons in place of the built-in glyphs |
| `blur` | `{ component, props? }` | none | A blur view, such as expo-blur's, for Android and iOS before 26; see [Customising](./customizing.md#blur-on-android) |
| `toastOptions` | [`ToastOptions`](./toast-options.md), plus per-type buckets | none | Defaults for every toast in this Toaster |
| `theme` | partial [theme tokens](./theme-tokens.md) | none | Token overrides |
| `colorScheme` | `'light'` or `'dark'` | the system's | Force light or dark tokens |
| `glass` | `boolean` or `GlassConfig` | `true` | `false` draws the opaque surface everywhere |
| `panThreshold` | `number` | `72` | Sideways swipe distance that dismisses; `0` turns swiping off |
| `haptics` | `boolean`, or a map from type to `ToastHaptic` | `true` | `true` plays each type's default (success, error, warning); a map picks per type: `{ success: 'medium', info: 'light' }` |
| `children` | `({ toast, theme }) => ReactNode` | none | Draw each toast yourself; see [Custom rendering](./custom-rendering.md) |

## GlassConfig

| Field | Type | Default | |
|---|---|---|---|
| `style` | `'regular'` or `'clear'` | `'regular'` | The Liquid Glass variant |
| `tintColor` | `string` | none | Tint over the glass |
| `interactive` | `boolean` | `false` | The glass reacts to touch |
| `containerize` | `boolean` | `true` | Put a stack in one glass container, so neighbours blend |
| `containerSpacing` | `number` | the `gap` | Distance at which neighbours blend |

`gutter` and `toastLimit` still work as deprecated names for `gap` and
`visibleToasts`.
