export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
} as const;

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
} as const;

export const impactAsync = async (_style?: unknown): Promise<void> => {};
export const notificationAsync = async (_type?: unknown): Promise<void> => {};

export default { ImpactFeedbackStyle, NotificationFeedbackType, impactAsync };