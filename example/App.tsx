import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Toaster, toast } from 'expo-hot-toast';

/** iOS system colours, so the screen reads as a stock grouped list. */
const palette = {
  light: {
    background: '#F2F2F7',
    row: '#FFFFFF',
    rowPressed: '#E5E5EA',
    separator: 'rgba(60,60,67,0.29)',
    label: '#000000',
    secondary: 'rgba(60,60,67,0.6)',
    tint: '#007AFF',
  },
  dark: {
    background: '#000000',
    row: '#1C1C1E',
    rowPressed: '#2C2C2E',
    separator: 'rgba(84,84,88,0.65)',
    label: '#FFFFFF',
    secondary: 'rgba(235,235,245,0.6)',
    tint: '#0A84FF',
  },
};

type Palette = (typeof palette)['light'];

/**
 * Set at bundle time by the Android and iOS CI jobs. On an emulator without a
 * GPU each tap takes about three seconds, and on the CI simulator a single step
 * can take forty, so a 2-second toast (or a 1.6-second request) is gone before
 * the test runner can read it. Automated runs stretch both, and
 * turn on tap to dismiss (off by default on iOS) so the flow can clear toasts
 * by tapping them instead of waiting.
 */
const E2E = process.env.EXPO_PUBLIC_E2E === '1';
const REQUEST_MS = E2E ? 15000 : 1600;

/** Resolves after `ms`, or rejects with `message` when one is given. */
function settleAfter(ms: number, message?: string): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (message ? reject(new Error(message)) : resolve()), ms),
  );
}

/**
 * A scripted run of toasts, for recording demos at a natural pace. Started by a
 * long-press on the title (testID `play-demo`), so a recording depends on one
 * tap, not on how fast a test runner can tap through every row. Every toast
 * names its own duration, which beats the E2E Toaster default.
 */
function playDemo() {
  const steps: Array<[number, () => void]> = [
    [1000, () => toast.success('Changes saved', { duration: 2600 })],
    [1900, () => toast.error('Could not reach the server', { duration: 3400 })],
    [
      5500,
      () => {
        void toast.promise(
          settleAfter(1800),
          { loading: 'Uploading photo…', success: 'Photo uploaded', error: 'Upload failed' },
          { success: { duration: 2400 } },
        );
      },
    ],
    [
      10300,
      () =>
        toast('Message archived', {
          duration: 3200,
          action: { label: 'Undo', onPress: () => toast.success('Message restored') },
        }),
    ],
    ...[1, 2, 3, 4, 5].map(
      (n): [number, () => void] => [
        14100 + n * 120,
        () => toast(`Item ${n} added to cart`, { duration: 1800 }),
      ],
    ),
    [21000, () => toast('Message sent', { position: 'bottom-center', duration: 2600 })],
  ];
  steps.forEach(([at, run]) => setTimeout(run, at));
}

function Row({
  title,
  detail,
  onPress,
  colors,
  last = false,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  colors: Palette;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      // Stable handles for the Maestro flows: on iOS the row's accessible text
      // is its title and detail together, so matching the title alone fails.
      testID={`row-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.rowPressed : colors.row },
      ]}
    >
      <View
        style={[
          styles.rowInner,
          !last && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.separator,
          },
        ]}
      >
        <Text style={[styles.rowTitle, { color: colors.tint }]}>{title}</Text>
        <Text style={[styles.rowDetail, { color: colors.secondary }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

function Section({
  header,
  footer,
  colors,
  children,
}: {
  header: string;
  footer?: string;
  colors: Palette;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: colors.secondary }]}>{header}</Text>
      <View style={[styles.group, { backgroundColor: colors.row }]}>{children}</View>
      {footer ? (
        <Text style={[styles.sectionFooter, { color: colors.secondary }]}>{footer}</Text>
      ) : null}
    </View>
  );
}

function Screen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = palette[scheme];
  const insets = useSafeAreaInsets();
  const [stacked, setStacked] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Pressable testID="play-demo" onLongPress={playDemo} accessibilityRole="header">
          <Text style={[styles.title, { color: colors.label }]}>expo-hot-toast</Text>
        </Pressable>
        <Text style={[styles.subtitle, { color: colors.secondary }]}>
          The react-hot-toast API for Expo. On iOS 26 each toast is drawn with
          the system Liquid Glass material.
        </Text>

        <Section header="Toasts" colors={colors}>
          <Row
            colors={colors}
            title="Success"
            detail="toast.success()"
            onPress={() => toast.success('Changes saved')}
          />
          <Row
            colors={colors}
            title="Error"
            detail="toast.error()"
            onPress={() => toast.error('Could not reach the server')}
          />
          <Row
            colors={colors}
            title="Promise"
            detail="toast.promise()"
            onPress={() => {
              void toast.promise(settleAfter(REQUEST_MS), {
                loading: 'Uploading photo…',
                success: 'Photo uploaded',
                error: 'Upload failed',
              });
            }}
          />
          <Row
            colors={colors}
            title="Promise that fails"
            detail="toast.promise()"
            onPress={() => {
              toast
                .promise(settleAfter(REQUEST_MS, 'offline'), {
                  loading: 'Syncing…',
                  success: 'Synced',
                  error: (cause) => `Sync failed: ${(cause as Error).message}`,
                })
                .catch(() => undefined);
            }}
          />
          <Row
            colors={colors}
            title="With an action"
            detail="action: Undo"
            onPress={() =>
              toast('Message archived', {
                action: {
                  label: 'Undo',
                  onPress: () => toast.success('Message restored'),
                },
              })
            }
          />
          <Row
            colors={colors}
            title="With a description"
            detail="description"
            onPress={() =>
              toast.error('Could not upload photo', {
                description: 'Check your connection and try again.',
              })
            }
          />
          <Row
            colors={colors}
            title="Rich colours"
            detail="richColors"
            last
            onPress={() => toast.success('Payment received', { richColors: true })}
          />
        </Section>

        <Section
          header="Queue"
          footer="Three toasts show at once; the rest wait and move up as space frees. Stacked tucks them behind the newest; press to fan them out."
          colors={colors}
        >
          <Row
            colors={colors}
            title="Burst of five"
            detail="visibleToasts: 3"
            onPress={() => {
              for (let i = 1; i <= 5; i += 1) toast(`Item ${i} added to cart`);
            }}
          />
          <Row
            colors={colors}
            title="Deduplicated"
            detail="dedupeKey"
            onPress={() =>
              toast('Saving draft…', { dedupeKey: 'draft', dedupeWindowMs: E2E ? 60000 : 3000 })
            }
          />
          <Row
            colors={colors}
            title="From the bottom"
            detail="position"
            onPress={() => toast('Message sent', { position: 'bottom-center' })}
          />
          <Row
            colors={colors}
            title="Stacked"
            detail={`stacked: ${stacked}`}
            last
            onPress={() => {
              // Start each mode from an empty screen.
              toast.dismiss();
              setStacked((on) => !on);
            }}
          />
        </Section>

        <Section
          header="Material"
          footer="Before iOS 26, on Android and with Reduce Transparency on, toasts use an opaque surface instead of glass."
          colors={colors}
        >
          <Row
            colors={colors}
            title="Opaque surface"
            detail="glass: false"
            onPress={() => toast('Drawn without glass', { glass: false })}
          />
          <Row
            colors={colors}
            title="Close button"
            detail="closeButton"
            onPress={() =>
              toast('Export started. This can take a minute.', {
                closeButton: true,
                // A toast's own duration beats the Toaster's, so automated
                // runs stretch this one too: the CI simulator outlasted 4.5 s
                // between showing it and tapping its close button.
                duration: E2E ? 60000 : 'long',
              })
            }
          />
          <Row
            colors={colors}
            title="Custom element"
            detail="toast.custom()"
            onPress={() =>
              toast.custom(
                <View style={[styles.custom, { backgroundColor: colors.tint }]}>
                  <Text style={styles.customText}>Fully custom content</Text>
                </View>,
              )
            }
          />
          <Row
            colors={colors}
            title="Dismiss all"
            detail="toast.dismiss()"
            last
            onPress={() => toast.dismiss()}
          />
        </Section>
      </ScrollView>

      <Toaster
        stacked={stacked}
        toastOptions={E2E ? { duration: 60000, dismissOnTap: true } : undefined}
      />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Screen />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  section: { marginTop: 28 },
  sectionHeader: {
    fontSize: 13,
    textTransform: 'uppercase',
    marginBottom: 7,
    paddingHorizontal: 16,
  },
  sectionFooter: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 7,
    paddingHorizontal: 16,
  },
  group: {
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: { paddingLeft: 16 },
  rowInner: {
    minHeight: 52,
    paddingRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: { fontSize: 17 },
  rowDetail: {
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  custom: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  customText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
