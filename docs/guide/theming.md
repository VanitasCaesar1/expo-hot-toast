---
title: Theming
description: Colours, shape, type and motion; light and dark; glass settings; tokens outside React.
group: Guides
order: 6
---

Toasts are styled through tokens: named values such as `radius`, `color` and
`motion.enter`. Pass the ones you want to change; the rest keep their
defaults. [Theme tokens](./theme-tokens.md) lists every token.

## For every toast

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

`motion` merges key by key, so changing `enter` keeps every other duration and
curve.

## For one toast

```tsx
toast.error('Payment declined', {
  theme: { color: '#FF453A' },
  style: { borderWidth: 1, borderColor: '#FF453A' },
  textStyle: { fontWeight: '600' },
});
```

`theme` overrides tokens for that toast. `style`, `textStyle` and `iconStyle`
are React Native styles for the toast, its message and its icon, applied
after the tokens.

## Rich colours

`richColors` gives success, error, info and warning toasts an outcome colour:
a green, red, blue or amber surface, border and text on the opaque surface, and
a matching tint on Liquid Glass. Blank, loading and custom toasts are
unchanged.

```tsx
toast.success('Payment received', { richColors: true });

<Toaster toastOptions={{ richColors: true }} />   // every toast with an outcome
```

The colours are the `rich` tokens, in light and dark; see
[Theme tokens](./theme-tokens.md#rich-colours).

## Light and dark

Toasts follow the system appearance: light tokens in light mode, dark tokens
in dark mode. If your app sets its own appearance, tell the Toaster, or dark
text can end up on a dark surface:

```tsx
<Toaster colorScheme="dark" />
```

Your `theme` overrides apply on top of whichever set is active.

## Glass

On iOS 26 the toast surface is Liquid Glass. Turn it off for a Toaster or a
single toast, and the opaque surface draws instead:

```tsx
<Toaster glass={false} />
toast('Offline', { glass: false });
```

Or configure it:

```tsx
<Toaster
  glass={{
    style: 'clear',          // 'regular' (default) or 'clear'
    tintColor: '#0A84FF33',
    interactive: true,       // the glass reacts to touch
    containerize: true,      // neighbouring toasts blend (default)
  }}
/>
```

The opaque surface uses `fallbackBackground`, `border`, `borderWidth` and the
shadow tokens. People with Reduce Transparency on always get it.

On the web, `glass` draws frosted glass instead of Liquid Glass. It fills with
`background`, lays any `tintColor` over it, blurs the page behind by
`frostBlur` and saturates it by `frostSaturation`, and lights the rim with
`frostHighlight`:

```tsx
<Toaster theme={{ frostBlur: 28, background: 'rgba(28,28,30,0.5)' }} />
```

## Tokens outside React

`resolveTheme` returns the full token set for a scheme, for use in a style
sheet or a test:

```tsx
import { resolveTheme } from 'expo-hot-toast';

const tokens = resolveTheme({ colorScheme: 'dark', theme: { radius: 14 } });
```

`toastCssVars` turns tokens into CSS custom properties, for styling systems
such as NativeWind or Unistyles:

```tsx
import { toastCssVars, resolveTheme } from 'expo-hot-toast';

const vars = toastCssVars(resolveTheme({ colorScheme: 'light' }));
```
