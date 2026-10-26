---
title: Accessibility
description: What screen readers hear, and how toasts respond to system settings.
group: Guides
order: 8
---

These work without configuration.

## Screen readers

- **iOS:** each toast is announced by VoiceOver when it appears. Errors
  interrupt what VoiceOver is saying; other types wait until it finishes.
- **Android:** each toast is a live region, which TalkBack reads. Errors are
  assertive, so they interrupt; other types wait their turn.

Mark another toast as urgent with `important`. It interrupts like an error, and
it goes ahead of the [queue](./timing-and-queue.md#the-visible-limit):

```tsx
toast('Your session expires in one minute', { important: true });
```

A `description` is announced after the message.

A toast whose message is an element, not a string, has no text to announce.
Give it one:

```tsx
toast(<RichMessage order={order} />, { accessibilityLabel: `Order ${order.id} shipped` });
```

Toasts with an action or close button expose the message and each button
separately, so VoiceOver and TalkBack can reach the buttons.

## Rich toasts

| Toast | What a screen reader hears |
|---|---|
| Progress | The message when it starts, and the outcome when it ends. The bar and percentage change too often to read, so they are hidden from it. |
| Steps | Each step with its place: "Uploading, step 2 of 3". The outcome is read on its own. |
| Repeats | The message with its count: "No connection. 3 times". Repeats do not announce again. |
| Expandable | A "Show details" button, reported as expanded or collapsed. The details are read once open. |
| Undo countdown | An "Undo" button. The draining ring is decoration. |
| Notification | Its title and body. The avatar is decoration. |

## Reduce Motion

Toasts fade in and out where they sit, with no travel or scaling, and icons
arrive already drawn: no pop and no checkmark draw-in. The stack still moves up
when a toast leaves, so the change is visible.

## Reduce Transparency

On iOS 26, toasts use the opaque surface instead of Liquid Glass. On the web,
the browser's `prefers-reduced-transparency` setting does the same for the
frosted glass.

## Text size

Toast text follows the system text size, up to twice the default. At the
larger sizes a toast takes up to six lines instead of three, so a message is
not cut short. Change the size cap with the `maxFontSizeMultiplier` token, or
remove it with `null`:

```tsx
<Toaster theme={{ maxFontSizeMultiplier: null }} />
```

## Haptics

Success, warning and error toasts play the system's notification haptic when
they appear, the pattern iOS and Android keep for the outcome of a task. Info,
loading and plain toasts play none.

Turn them off for a Toaster, or for one toast:

```tsx
<Toaster haptics={false} />
toast.success('Saved', { haptics: false });
```

## Collapsed stacks

A `stacked` Toaster hides the content of toasts tucked behind the front one.
While VoiceOver or TalkBack is running, the stack stays fanned out instead.
