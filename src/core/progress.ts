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
/** The last `progress` field written for each toast; see `applyOwnProgress`. */
const applied = new Map<string, number | 'indeterminate'>();

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

/**
 * Writes a toast's own `progress` field, once per value. A toast that comes
 * back from the queue mounts again with the field it was created with, and
 * writing that on every mount set a bar that `set()` had moved on back to 0.
 */
export function applyOwnProgress(id: string, progress: number | 'indeterminate'): void {
  if (applied.get(id) === progress) return;
  applied.set(id, progress);
  setProgress(id, progress);
}

/** Forgets a toast's progress once it has left. */
export function dropProgress(id: string): void {
  values.delete(id);
  applied.delete(id);
}

export function isIndeterminate(value: number): boolean {
  'worklet';
  return value < 0;
}

/** Test-only. */
export function __resetProgress(): void {
  values.clear();
  applied.clear();
}
