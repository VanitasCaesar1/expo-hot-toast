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
| `background` | `rgba(255,255,255,0.72)` | `rgba(28,28,30,0.72)` | Fill of the frosted glass on the web |
| `border` | `rgba(255,255,255,0.6)` | `rgba(255,255,255,0.14)` | Border of the opaque surface and the frosted glass |
| `frostBlur` | `18` | same | Web only: backdrop blur, in px |
| `frostSaturation` | `180` | same | Web only: backdrop saturation, in percent |
| `frostHighlight` | `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.3)` | Web only: light in the glass rim |
| `borderWidth` | `0` on 3x screens, else `1` | same | |
| `radius` | `22` | same | Corner radius |
| `shadowColor` | `#000000` | same | Opaque surface and frosted glass |
| `shadowOpacity` | `0.12` | `0.3` | |
| `shadowRadius` | `16` | same | |
| `shadowOffsetY` | `6` | same | |
| `elevation` | `8` | same | Android shadow |

Liquid Glass draws its own material and ignores the fill, border and shadow.

## Layout

| Token | Default | |
|---|---|---|
| `paddingVertical` | `14` | |
| `paddingHorizontal` | `18` | |
| `maxWidth` | `340` | A toast grows with its message up to this width |
| `gap` | `10` | Space between the icon, message and buttons |
| `iconSize` | `22` | |
| `fill` | `false` | `true` stretches the toast to its stack's width, as a snackbar does |

## Text

| Token | Light | Dark | |
|---|---|---|---|
| `color` | `#1c1c1e` | `#f2f2f7` | Message and spinner |
| `fontSize` | `15` | same | |
| `lineHeight` | `20` | same | |
| `fontWeight` | `'500'` | same | |
| `maxFontSizeMultiplier` | `2` | same | Cap on system text size; `null` removes it |
| `descriptionColor` | `rgba(60,60,67,0.78)` | `rgba(235,235,245,0.68)` | The description line |
| `descriptionFontSize` | `13` | same | |
| `descriptionLineHeight` | `18` | same | |
| `fontFamily` | system | same | The message's font |
| `descriptionFontFamily` | `fontFamily` | same | |
| `actionFontFamily` | `fontFamily` | same | The action and cancel labels |
| `maxLines` | `3` | same | Lines of message before it truncates; `0` for no limit |
| `descriptionMaxLines` | `3` | same | |

With Bold Text on (iOS), every weight steps up one notch, as system text does.

## Buttons

| Token | Light | Dark | |
|---|---|---|---|
| `actionColor` | `#0A84FF` | same | Action button label |
| `actionPaddingHorizontal` | `12` | same | |
| `closeButtonBackground` | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.18)` | Circle behind the × |

## Rich colours

Used by toasts with `richColors`. Override one field without losing the rest:
`theme={{ rich: { error: { tint: 'rgba(255,0,0,0.3)' } } }}`.

| Token | Light | Dark | |
|---|---|---|---|
| `rich.success.background` | `#ECFDF3` | `#032313` | Opaque surface |
| `rich.success.border` | `#BFF5D6` | `#0B4425` | |
| `rich.success.color` | `#00702A` | `#5FE39A` | Message and description |
| `rich.success.tint` | `rgba(52,199,89,0.22)` | `rgba(48,209,88,0.26)` | Tint over Liquid Glass and frosted glass |
| `rich.error.background` | `#FFF0F0` | `#2E0809` | |
| `rich.error.border` | `#FFD9DA` | `#561317` | |
| `rich.error.color` | `#C8000F` | `#FF8F92` | |
| `rich.error.tint` | `rgba(255,59,48,0.22)` | `rgba(255,69,58,0.26)` | |
| `rich.info.background` | `#EEF6FF` | `#06203D` | |
| `rich.info.border` | `#C9E2FF` | `#0E3A6B` | |
| `rich.info.color` | `#0058C4` | `#7DB9FF` | |
| `rich.info.tint` | `rgba(10,132,255,0.2)` | `rgba(10,132,255,0.26)` | |
| `rich.warning.background` | `#FFF8EB` | `#2B1B02` | |
| `rich.warning.border` | `#FFE2B0` | `#4D3205` | |
| `rich.warning.color` | `#9A5B00` | `#FFC56B` | |
| `rich.warning.tint` | `rgba(255,159,10,0.24)` | `rgba(255,159,10,0.28)` | |

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
