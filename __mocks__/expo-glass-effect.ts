/**
 * Stand-in for expo-glass-effect. Reports "no glass" so tests exercise the
 * opaque fallback path, which is the one that has to work everywhere.
 */
export const isLiquidGlassAvailable = (): boolean => false;
export const isGlassEffectAPIAvailable = (): boolean => false;

export const GlassView = 'GlassView';
export const GlassContainer = 'GlassContainer';

export default { GlassView, GlassContainer, isLiquidGlassAvailable };