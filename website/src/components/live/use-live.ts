import { useSyncExternalStore } from 'react';
import { getConfig, subscribe } from '../../lib/live';
import type { LiveConfig } from '../../lib/live';

/** The page Toaster's props, shared by every live control. */
export function useLiveConfig(): LiveConfig {
  return useSyncExternalStore(subscribe, getConfig, getConfig);
}
