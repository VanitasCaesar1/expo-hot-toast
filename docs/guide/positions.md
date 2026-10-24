---
title: Positions
description: Where toasts appear, spacing, several Toasters, and showing toasts above modals.
group: Guides
order: 4
---

## Six positions

`top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center` and
`bottom-right`. Set the default on the Toaster, and override it per toast.

```tsx
<Toaster position="top-center" />

toast('Message sent', { position: 'bottom-center' });
```

Each position is its own stack with its own queue. Top stacks start below the
status bar and Dynamic Island; bottom stacks sit above the home indicator, and
rise above the keyboard while it is open.

## Spacing

```tsx
<Toaster
  offset={16}   // distance from the screen edge, added to the safe area
  gap={14}      // space between toasts in a stack
/>
```

The values shown are the defaults.

## Stack order

The newest toast sits nearest the edge: at the top of a top stack, at the
bottom of a bottom stack. `reverseOrder` puts it at the far end instead.

```tsx
<Toaster reverseOrder />
```

## Several Toasters

Give each Toaster an id, and send toasts to it with `toasterId`. Toasts without
one go to the Toaster whose id is `'default'`, which is what a Toaster without
a `toasterId` is.

```tsx
<Toaster />                                   // 'default'
<Toaster toasterId="editor" position="bottom-center" />

toast('Saved');                               // default Toaster
toast('Formatting applied', { toasterId: 'editor' });
```

Each Toaster has its own queue, settings and timers. Updating a toast by `id`
finds it in whichever Toaster already shows it.

## Above modals and sheets

A native modal or sheet covers everything rendered before it, toasts included.
On iOS, render the Toaster inside `FullWindowOverlay` from
`react-native-screens` to keep toasts on top:

```tsx
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { Toaster } from 'expo-hot-toast';

<Toaster ContainerComponent={Platform.OS === 'ios' ? FullWindowOverlay : undefined} />
```

`react-native-screens` is not a dependency of this package; Expo Router and
React Navigation apps already have it. The Toaster wraps its content in its own
`GestureHandlerRootView`, which swiping needs inside a separate window.
