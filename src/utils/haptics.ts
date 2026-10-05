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
 * Loading deliberately has none. It can sit on screen for a long time and a
 * repeating buzz would be intolerable.
 */
const PATTERNS: Partial<Record<ToastType, Haptics.ImpactFeedbackStyle>> = {
  success: Haptics.ImpactFeedbackStyle.Light,
  error: Haptics.ImpactFeedbackStyle.Rigid,
};

export function triggerToastHaptic(type: ToastType): void {
  // Android's Taptic Engine equivalent is a short vibration; there is no
  // equivalent to ImpactFeedbackStyle, so errors get the stronger pattern.
  if (Platform.OS === 'android') {
    void Haptics.notificationAsync(
      type === 'error'
        ? Haptics.NotificationFeedbackType.Error
        : Haptics.NotificationFeedbackType.Success,
    );
    return;
  }

  const style = PATTERNS[type];
  if (!style) return;

  void Haptics.impactAsync(style).catch(() => {
    // A failed haptic must never break a toast. Some devices and some
    // simulators simply have no actuator.
  });
}