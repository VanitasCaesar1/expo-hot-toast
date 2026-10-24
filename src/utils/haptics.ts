import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ToastType } from '../core/types';

/**
 * Haptic feedback, fired once when a toast becomes visible.
 *
 * Errors and successes get distinct patterns on purpose: an error that buzzes
 * like a success is worse than no handoff at all, and on a device with a
 * screen reader or in a meeting, the buzz is the only channel that reliably
 * gets through.
 *
 * Only success and error buzz. Loading can sit on screen for a long time, and a
 * blank or custom toast carries no outcome worth feeling.
 */
const PATTERNS: Partial<Record<ToastType, Haptics.ImpactFeedbackStyle>> = {
  success: Haptics.ImpactFeedbackStyle.Light,
  error: Haptics.ImpactFeedbackStyle.Rigid,
};

export function triggerToastHaptic(type: ToastType): void {
  const style = PATTERNS[type];
  if (!style) return;

  // A failed haptic must never break a toast. Some devices and some simulators
  // simply have no actuator.
  const ignore = (): void => {};

  // Android has no equivalent of ImpactFeedbackStyle, so it gets the matching
  // notification pattern instead.
  if (Platform.OS === 'android') {
    void Haptics.notificationAsync(
      type === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success,
    ).catch(ignore);
    return;
  }

  void Haptics.impactAsync(style).catch(ignore);
}