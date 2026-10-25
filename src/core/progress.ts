import { makeMutable } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

/**
 * Progress lives outside React, one shared value per toast id. Setting it
 * writes the value straight to the UI thread, where the bar reads it, so a
 * progress toast can update sixty times a second without a single re-render.
 *
 * -1 stands for indeterminate.
 */
const INDETERMINATE = -1;
const values = new Map<string, SharedValue<number>>();

/** The shared value behind a toast's progress, created at 0 on first use. */
export function progressValue(id: string): SharedValue<number> {
  let value = values.get(id);
  if (!value) {
    value = makeMutable(0);
    values.set(id, value);
  }
  return value;
}

export function setProgress(id: string, progress: number | 'indeterminate'): void {
  const value = progressValue(id);
  value.value = progress === 'indeterminate' ? INDETERMINATE : Math.min(Math.max(progress, 0), 1);
}

/** Forgets a toast's progress once it has left. */
export function dropProgress(id: string): void {
  values.delete(id);
}

export function isIndeterminate(value: number): boolean {
  'worklet';
  return value < 0;
}

/** Test-only. */
export function __resetProgress(): void {
  values.clear();
}
