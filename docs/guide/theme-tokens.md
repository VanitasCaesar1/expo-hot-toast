---
title: Theme tokens
description: Every token, with its light and dark default.
group: Reference
order: 4
---

Override any of these with `<Toaster theme>` or a toast's `theme` option. See
[Theming](./theming.md) for how.

## Surface

| Token | Light | Dark | |
|---|---|---|---|
| `fallbackBackground` | `#FFFFFF` | `#2C2C2E` | Fill of the opaque surface |
| `border` | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.14)` | Border of the opaque surface |
| `borderWidth` | `0` on 3x screens, else `1` | same | |
| `radius` | `22` | same | Corner radius |
| `shadowColor` | `#000000` | same | Opaque surface only |
| `shadowOpacity` | `0.12` | `0.3` | |
| `shadowRadius` | `16` | same | |
| `shadowOffsetY` | `6` | same | |
| `elevation` | `8` | same | Android shadow |
| `background` | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.72)` | Not drawn by the built-in surface; for custom renderers and CSS variables |

Liquid Glass draws its own material and ignores the fill, border and shadow.

## Layout

| Token | Default | |
|---|---|---|
| `paddingVertical` | `14` | |
| `paddingHorizontal` | `18` | |
| `maxWidth` | `340` | A toast grows with its message up to this width |
| `gap` | `10` | Space between the icon, message and buttons |
| `iconSize` | `22` | |

## Text

| Token | Light | Dark | |
|---|---|---|---|
| `color` | `#1c1c1e` | `#f2f2f7` | Message and spinner |
| `fontSize` | `15` | same | |
| `lineHeight` | `20` | same | |
| `fontWeight` | `'500'` | same | |
| `maxFontSizeMultiplier` | `2` | same | Cap on system text size; `null` removes it |

## Buttons

| Token | Light | Dark | |
|---|---|---|---|
| `actionColor` | `#0A84FF` | same | Action button label |
| `actionPaddingHorizontal` | `12` | same | |
| `closeButtonBackground` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.18)` | Circle behind the × |

## Motion

Durations are in milliseconds. Set any subset with `theme={{ motion: { … } }}`.

| Token | Default | |
|---|---|---|
| `enter` | `350` | Enter animation |
| `exit` | `400` | Exit animation |
| `queueShift` | `230` | The stack moving when a toast joins or leaves |
| `iconPop` | `300` | Icon pop |
| `iconPopDelay` | `120` | Delay before the icon pops |
| `stagger` | `320` | Extra time per position further from the edge |
| `staggerMax` | `900` | Cap on that extra time |
| `enterTranslate` | `0.2` | Enter travel, as a fraction of the toast's height |
| `exitTranslate` | `0.15` | Exit travel |
| `enterScale` | `0.6` | Scale a toast enters from |
| `exitScale` | `0.6` | Scale a toast leaves to |
| `enterEasing` | `Easing.bezier(0.21, 1.02, 0.73, 1)` | Overshoots slightly, as react-hot-toast does |
| `exitEasing` | `Easing.bezier(0.06, 0.71, 0.55, 1)` | Decelerates, without a bounce |
| `iconEasing` | `Easing.bezier(0.175, 0.885, 0.32, 1.275)` | |

Easings are Reanimated easing functions.
