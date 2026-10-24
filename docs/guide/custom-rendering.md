---
title: Custom rendering
description: Change what a toast contains, draw it yourself, or build your own Toaster.
group: Guides
order: 7
---

There are three levels, from least to most work.

## 1. Rearrange the inside, keep the surface

Pass the Toaster a function and return a `<ToastBar>`. Its child function
receives the built-in `icon`, the `message` and the toast's `description`;
arrange them, and add your own elements. The surface, gestures, timers and motion stay as they are.

```tsx
import { Pressable, Text } from 'react-native';
import { Toaster, ToastBar, toast } from 'expo-hot-toast';

<Toaster>
  {({ toast: t }) => (
    <ToastBar toast={t}>
      {({ icon, message }) => (
        <>
          {icon}
          {message}
          {t.type !== 'loading' && (
            <Pressable onPress={() => toast.dismiss(t.id)} hitSlop={8}>
              <Text>Dismiss</Text>
            </Pressable>
          )}
        </>
      )}
    </ToastBar>
  )}
</Toaster>
```

`ToastBar` reads the Toaster's theme and settings, so you do not pass them.

## 2. Draw each toast yourself

Return your own element from the Toaster's function. You get the toast and the
resolved theme; `resolveValue` turns the message into something you can render.

```tsx
import { Text, View } from 'react-native';
import { Toaster, resolveValue } from 'expo-hot-toast';

<Toaster>
  {({ toast: t, theme }) => (
    <View style={{ backgroundColor: theme.fallbackBackground, borderRadius: theme.radius, padding: 12 }}>
      <Text style={{ color: theme.color }}>{resolveValue(t.message, t)}</Text>
    </View>
  )}
</Toaster>
```

You give up the built-in surface and gestures, but keep positioning, the queue
and timers.

For a single toast with your own element, `toast.custom(<MyBanner />)` is
simpler; see [Toast types](./toast-types.md#custom-toasts).

## 3. Build your own Toaster

`useToaster` gives you the state and leaves all the drawing to you.

```tsx
import { useToaster, resolveValue } from 'expo-hot-toast';

function MyToaster() {
  const { toasts, pending, startPause, endPause } = useToaster();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {toasts.map((t) => (
        <Pressable key={t.id} onPressIn={startPause} onPressOut={endPause}>
          <Text>{resolveValue(t.message, t)}</Text>
        </Pressable>
      ))}
      {pending.length > 0 && <Text>+{pending.length} more</Text>}
    </View>
  );
}
```

`toasts` are the ones that should be on screen; `pending` are queued behind
them. Each toast's `visible` flag turns false when it is dismissed: play your
exit then. `startPause` and `endPause` are also returned as `handlers`, as in
react-hot-toast.

`useToaster` takes an options object: `toastOptions`, `toasterId`,
`visibleToasts`, `maxPending`, `dropPolicy`, `defaultPosition` and `paused`,
with the same meanings as the [Toaster props](./toaster-props.md).
