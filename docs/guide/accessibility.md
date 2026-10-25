---
title: Accessibility
description: What screen readers hear, and how toasts respond to system settings.
group: Guides
order: 8
---

These work without configuration.

## Screen readers

- **iOS:** each toast is announced by VoiceOver when it appears.
- **Android:** each toast is a live region, which TalkBack reads. Errors are
  assertive, so they interrupt; other types wait their turn.

Mark another toast as urgent with `important`:

```tsx
toast('Your session expires in one minute', { important: true });
```

iOS cannot interrupt an announcement already in progress, so there `important`
has no effect.

A `description` is announced after the message.

A toast whose message is an element, not a string, has no text to announce.
Give it one:

```tsx
toast(<RichMessage order={order} />, { accessibilityLabel: `Order ${order.id} shipped` });
```

Toasts with an action or close button expose the message and each button
separately, so VoiceOver and TalkBack can reach the buttons.

## Reduce Motion

Toasts fade in and out where they sit, with no travel or scaling, and icons
arrive already drawn: no pop and no checkmark draw-in. The stack still moves up
when a toast leaves, so the change is visible.

## Reduce Transparency

On iOS 26, toasts use the opaque surface instead of Liquid Glass. On the web,
the browser's `prefers-reduced-transparency` setting does the same for the
frosted glass.

## Text size

Toast text follows the system text size, up to twice the default. Past that it
stops growing, because a toast holds three lines at most. Change the cap with
the `maxFontSizeMultiplier` token, or remove it with `null`:

```tsx
<Toaster theme={{ maxFontSizeMultiplier: null }} />
```

## Haptics

Success and error toasts trigger a haptic when they appear: a light tap for
success and a firmer one for errors on iOS, and the matching notification
pattern on Android. Other types do not.

Turn them off for a Toaster, or for one toast:

```tsx
<Toaster haptics={false} />
toast.success('Saved', { haptics: false });
```

## Collapsed stacks

A `stacked` Toaster hides the content of toasts tucked behind the front one.
While VoiceOver or TalkBack is running, the stack stays fanned out instead.
