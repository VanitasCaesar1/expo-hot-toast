import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Toaster, toast } from 'expo-hot-toast';

/**
 * The library as a page-level Toaster for the project website. The website
 * loads this same web build with `window.__EHT_EMBED__` set, mounts it over the
 * whole page, and calls the real `toast` through `window.expoHotToast`, so
 * every button on the site fires a real toast over the page.
 *
 * Every full-page layer passes touches through (`box-none`); only the toasts
 * themselves take the pointer, so the page under them stays usable.
 *
 * A page can also mark elements with `data-toast-stage="<id>"` (an empty value
 * means "stage"): an independent Toaster with that toasterId mounts inside
 * each one, for the hero and the feature tiles.
 */
export type EmbedConfig = Omit<ComponentProps<typeof Toaster>, 'children' | 'ContainerComponent'>;

declare global {
  interface Window {
    __EHT_EMBED__?: boolean | { config?: EmbedConfig };
    expoHotToast?: {
      toast: typeof toast;
      /** Merges into the Toaster's props. Pass `undefined` to reset a prop. */
      configure: (config: EmbedConfig) => void;
      /** Examples that need React elements, which the page cannot build. */
      examples: Record<string, (options?: Record<string, unknown>) => void>;
      /** Props for a stage's Toaster; `id` defaults to "stage". */
      configureStage: (config: EmbedConfig, id?: string) => void;
    };
  }
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/** The Toaster's colour scheme, so text the examples draw themselves matches it. */
let scheme: 'light' | 'dark' = 'light';

const examples: Record<string, (options?: Record<string, unknown>) => void> = {
  custom: () =>
    toast.custom((t) => (
      <View style={[styles.custom, { opacity: t.visible ? 1 : 0 }]}>
        <Text style={styles.customText}>🍞 Toast, served your way</Text>
      </View>
    )),
  jsx: () =>
    toast((t) => (
      <Text style={[styles.jsx, { color: scheme === 'dark' ? '#F2F2F7' : '#1C1C1E' }]}>
        Custom and <Text style={styles.bold}>bold</Text>
        {'  '}
        <Text style={styles.link} onPress={() => toast.dismiss(t.id)}>
          Dismiss
        </Text>
      </Text>
    )),
  // A notification needs its avatar drawn: initials on a colour, as in the app.
  notify: (options) =>
    toast.notify({
      title: 'Maya Patel',
      body: 'Sent you 4 photos from the trip',
      timestamp: 'now',
      avatar: (
        <View style={styles.initials}>
          <Text style={styles.initialsText}>MP</Text>
        </View>
      ),
      ...options,
    }),
};

export default function Embed() {
  const initial = typeof window.__EHT_EMBED__ === 'object' ? window.__EHT_EMBED__.config : undefined;
  const [config, setConfig] = useState<EmbedConfig>(initial ?? {});
  const [stageConfigs, setStageConfigs] = useState<Record<string, EmbedConfig>>({});
  const [stages, setStages] = useState<HTMLElement[]>([]);
  scheme = config.colorScheme ?? 'light';

  useEffect(() => {
    window.expoHotToast = {
      toast,
      configure: (next) => setConfig((current) => ({ ...current, ...next })),
      examples,
      configureStage: (next, id = 'stage') =>
        setStageConfigs((current) => ({ ...current, [id]: { ...current[id], ...next } })),
    };
    setStages([...document.querySelectorAll<HTMLElement>('[data-toast-stage]')]);
    window.dispatchEvent(new Event('expo-hot-toast:ready'));
    return () => {
      delete window.expoHotToast;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root} pointerEvents="box-none">
      <SafeAreaInsetsContext.Provider value={NO_INSETS}>
        <Toaster {...config} />
        {stages.map((element) => {
          const id = element.dataset.toastStage || 'stage';
          return createPortal(<Toaster {...stageConfigs[id]} toasterId={id} />, element, id);
        })}
      </SafeAreaInsetsContext.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  custom: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#E8590C',
  },
  customText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  jsx: { fontSize: 15, lineHeight: 20 },
  bold: { fontWeight: '700' },
  link: { color: '#0A84FF', fontWeight: '600' },
  initials: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF9F0A' },
  initialsText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
