export const PixelRatio = {
  get: () => 2,
  roundToNearestPixel: (n: number) => n,
};

export const Platform = { OS: 'ios' as const, select: (o: Record<string, unknown>) => o.ios };

export const useColorScheme = (): 'light' | 'dark' | null => 'light';

export const AccessibilityInfo = {
  isReduceMotionEnabled: async () => false,
  isReduceTransparencyEnabled: async () => false,
  addEventListener: () => ({ remove: () => {} }),
  announceForAccessibility: () => {},
};

export const AppState = {
  currentState: 'active' as const,
  addEventListener: () => ({ remove: () => {} }),
};

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFill: {} as object,
  absoluteFillObject: {} as object,
  hairlineWidth: 1,
};

export const View = 'View';
export const Text = 'Text';
export const Pressable = 'Pressable';
export const ActivityIndicator = 'ActivityIndicator';

export const Keyboard = { addListener: () => ({ remove: () => {} }) };

export default {
  PixelRatio,
  Platform,
  useColorScheme,
  AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Keyboard,
};