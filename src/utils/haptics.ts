import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ToastHaptic, ToastType } from '../core/types';

export type { ToastHaptic };

/** Which haptic each type plays by default. Info and loading play none. */
export const DEFAULT_HAPTICS: Partial<Record<ToastType, ToastHaptic>> = {
  success: 'light',
  error: 'rigid',
  warning: 'warning',
};

const IMPACTS: Record<string, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
  soft: Haptics.ImpactFeedbackStyle.Soft,
};

const NOTIFICATIONS: Record<string, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

/**
 * Plays `haptic`, or the type's default. A failed haptic must never break a
 * toast: some devices and most simulators have no actuator.
 */
export function triggerToastHaptic(type: ToastType, haptic: ToastHaptic | undefined = DEFAULT_HAPTICS[type]): void {
  if (!haptic) return;
  const ignore = (): void => {};

  // Android has no equivalent of the impact weights, so an impact plays the
  // notification pattern that matches the toast's outcome instead.
  if (Platform.OS === 'android' && IMPACTS[haptic]) {
    const pattern = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success';
    void Haptics.notificationAsync(NOTIFICATIONS[pattern]!).catch(ignore);
    return;
  }

  if (NOTIFICATIONS[haptic]) {
    void Haptics.notificationAsync(NOTIFICATIONS[haptic]!).catch(ignore);
    return;
  }
  void Haptics.impactAsync(IMPACTS[haptic]!).catch(ignore);
}
