import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Toaster,
  toast,
  toastCssVars,
  useGlassMode,
} from 'expo-hot-toast';

const vars = toastCssVars();

function Button({
  label,
  onPress,
  tone = 'default',
}: {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'glass';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'glass' && styles.buttonGlass,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [position, setPosition] = useState<'top-center' | 'bottom-center'>('top-center');
  const [limit, setLimit] = useState(false);
  const fired = useRef(false);

  // Fires a representative stack shortly after mount so the glass render can be
  // verified from a screenshot on a headless simulator, where there is no way to
  // tap a button. Remove this block for interactive use.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const timers = [
      setTimeout(
        () =>
          toast.success('Changes saved', {
            closeButton: true,
            action: { label: 'Undo', onPress: () => undefined },
          }),
        600,
      ),
      setTimeout(() => toast('Queued item', { duration: 'short' }), 1100),
      setTimeout(() => toast('Queued item', { duration: 'short' }), 1500),
      setTimeout(() => toast('Queued item', { duration: 'short' }), 1900),
      setTimeout(
        () =>
          toast.error('Could not reach the server', {
            closeButton: true,
            action: { label: 'Retry', onPress: () => undefined },
          }),
        2300,
      ),
      // Long-lived so the stack is still on screen whenever the screenshot is
      // taken, regardless of how slow the capture is.
      setTimeout(
        () =>
          toast('Held open for capture — drag me sideways', {
            duration: 'infinite',
            closeButton: true,
          }),
        2700,
      ),
    ];

    return () => {
      timers.forEach(clearTimeout);
      // Reset on unmount. Fast Refresh preserves refs across a refresh, so a
      // guard that is never cleared would permanently suppress the demo after
      // the first edit — and the dev menu appears to mount the tree again.
      fired.current = false;
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.root}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>expo-hot-toast</Text>
            <Text style={styles.subtitle}>
              react-hot-toast for Expo, on real Liquid Glass.
            </Text>

            <Text style={styles.section}>Basics</Text>
            <Button label="toast('Saved')" onPress={() => toast('Saved')} />
            <Button label="toast.success" onPress={() => toast.success('Changes saved')} />
            <Button label="toast.error" onPress={() => toast.error('Could not reach the server')} />
            <Button label="toast.loading (never auto-dismisses)" onPress={() => toast.loading('Uploading…')} />

            <Text style={styles.section}>Queue behaviour</Text>
            <Button
              label="Fire 5 at once (watch the glass merge)"
              onPress={() => {
                for (let i = 0; i < 5; i += 1) {
                  toast(`Queued item ${i + 1}`);
                }
              }}
            />
            <Button
              label="Burst 12 (over the limit)"
              onPress={() => {
                for (let i = 0; i < 12; i += 1) {
                  toast(`Burst ${i + 1}`);
                }
              }}
            />
            <Button label="Dismiss all" onPress={() => toast.dismissAll()} />

            <Text style={styles.section}>toast.promise</Text>
            <Button
              label="Resolves after 1.4s"
              onPress={() => {
                toast.promise(
                  new Promise((resolve) => setTimeout(() => resolve('done'), 1400)),
                  {
                    loading: 'Uploading your files…',
                    success: (value) => `Finished: ${value}`,
                    error: 'Upload failed',
                  },
                );
              }}
            />
            <Button
              label="Rejects after 1.4s"
              onPress={() => {
                toast.promise(
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('offline')), 1400),
                  ),
                  {
                    loading: 'Connecting…',
                    error: (e) => `Failed: ${(e as Error).message}`,
                  },
                );
              }}
            />

            <Text style={styles.section}>Controls</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Bottom position</Text>
              <Switch value={position === 'bottom-center'} onValueChange={() => setPosition(position === 'top-center' ? 'bottom-center' : 'top-center')} />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Limit to 3</Text>
              <Switch value={limit} onValueChange={setLimit} />
            </View>

            <Text style={styles.section}>Force the opaque fallback</Text>
            <Button
              label="Show a toast with glass={false}"
              onPress={() => toast('Opaque fallback, no UIGlassEffect', { glass: false })}
            />

            <Text style={styles.footnote}>
              Try drag-to-dismiss, and press-and-hold to freeze the queue.
              {`\nCSS vars available: ${Object.keys(vars).length} tokens.`}
            </Text>
          </ScrollView>

          <Toaster
            position={position}
            toastLimit={limit ? 3 : undefined}
            glass
            // The demo UI is dark no matter what the OS says, so the tokens
            // have to be forced too — otherwise light-theme text lands on dark
            // glass and is effectively unreadable.
            colorScheme="dark"
            // Matches both Sonner implementations. The overflow is queued and
            // promoted, not evicted.
            visibleToasts={3}
            gap={12}
            toastOptions={{ closeButton: true }}
          />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0B0F' },
  content: { padding: 24, paddingBottom: 120 },
  title: { color: '#FFF', fontSize: 30, fontWeight: '700', marginTop: 48 },
  subtitle: { color: '#9A9AA2', fontSize: 15, marginTop: 6, marginBottom: 28 },
  section: {
    color: '#6C6C76',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#1C1C22',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2E2E38',
  },
  buttonGlass: { backgroundColor: 'rgba(255,255,255,0.08)' },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rowLabel: { color: '#DDD', fontSize: 15 },
  footnote: {
    color: '#5A5A64',
    fontSize: 12,
    marginTop: 32,
    lineHeight: 18,
  },
});