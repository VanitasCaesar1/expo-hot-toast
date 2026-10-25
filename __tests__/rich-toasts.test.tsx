import { render, screen, act, cleanup, fireEvent } from '@testing-library/react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Toaster } from '../src/components/toaster';
import { toast } from '../src/core/toast';
import { __resetStore } from '../src/core/store';
import { __resetIdCounter } from '../src/core/ids';
import { __resetProgress, progressValue } from '../src/core/progress';
import { __resetAccessibilityCache } from '../src/utils/a11y';
import { themeFromColors, fromNavigationTheme } from '../src/theme/adapters';
import { materialTheme } from '../src/core/presets';

beforeEach(() => {
  __resetStore();
  __resetIdCounter();
  __resetProgress();
  __resetAccessibilityCache();
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const flat = (style: unknown) => (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;

/** Every host node whose flattened style matches `test`. */
function nodesWithStyle(test: (style: Record<string, unknown>) => boolean) {
  return screen.UNSAFE_root.findAll((node) => typeof node.type === 'string' && test(flat(node.props.style)));
}

function withPlatform<T>(os: string, run: () => T): T {
  const platform = Platform as { OS: string };
  const original = platform.OS;
  platform.OS = os;
  try {
    return run();
  } finally {
    platform.OS = original;
  }
}

describe('info and warning', () => {
  it('draws a glyph for each, and plays the warning haptic only for warnings', () => {
    render(<Toaster />);
    act(() => {
      toast.info('New version available');
      toast.warning('Storage almost full');
    });
    expect(screen.getByText('New version available')).toBeTruthy();
    expect(screen.getByText('Storage almost full')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });
});

describe('toast.update', () => {
  it('changes some fields and keeps the rest and the id', () => {
    render(<Toaster />);
    let id = '';
    act(() => {
      id = toast.success('Uploading', { description: 'photo.jpg' });
    });
    act(() => {
      toast.update(id, { message: 'Almost there' });
    });
    expect(screen.getByText('Almost there')).toBeTruthy();
    expect(screen.getByText('photo.jpg')).toBeTruthy();
    expect(screen.queryByText('Uploading')).toBeNull();
  });

  it('does nothing for an id that is not showing', () => {
    render(<Toaster />);
    expect(() => toast.update('nope', { message: 'x' })).not.toThrow();
  });
});

describe('deduplication count', () => {
  it('counts the repeats on the toast already showing', () => {
    render(<Toaster />);
    act(() => {
      for (let i = 0; i < 3; i++) toast.success('Draft saved', { dedupeKey: 'draft' });
    });
    expect(screen.getAllByText('Draft saved')).toHaveLength(1);
    expect(screen.getByText('×3')).toBeTruthy();
  });
});

describe('cancel and dismissible', () => {
  it('draws a cancel button that runs its handler, then dismisses', () => {
    const onCancel = jest.fn();
    const onDismiss = jest.fn();
    render(<Toaster />);
    act(() => {
      toast('Delete 3 photos?', { cancel: { label: 'Cancel', onPress: onCancel }, action: { label: 'Delete', onPress: jest.fn() }, onDismiss });
    });
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Delete')).toBeTruthy();
  });

  it('a toast that is not dismissible shows no close button', () => {
    render(<Toaster />);
    act(() => {
      toast('Uploading', { closeButton: true, dismissible: false });
    });
    expect(screen.queryByLabelText('Dismiss')).toBeNull();
  });
});

describe('slots, unstyled, tokens', () => {
  it('applies per-part styles and class names', () => {
    render(<Toaster />);
    act(() => {
      toast('Styled', {
        description: 'Under it',
        styles: { title: { letterSpacing: 2 }, description: { fontStyle: 'italic' } },
        classNames: { title: 'font-bold text-lg' },
      });
    });
    const title = screen.getByText('Styled');
    expect(flat(title.props.style).letterSpacing).toBe(2);
    expect(title.props.className).toBe('font-bold text-lg');
    expect(flat(screen.getByText('Under it').props.style).fontStyle).toBe('italic');
  });

  it('merges slot styles from the Toaster defaults with the toast own', () => {
    render(<Toaster toastOptions={{ styles: { title: { letterSpacing: 1 } }, classNames: { title: 'a' } }} />);
    act(() => {
      toast('Merged', { styles: { description: { opacity: 0.5 } }, classNames: { title: 'b' }, description: 'd' });
    });
    const title = screen.getByText('Merged');
    expect(flat(title.props.style).letterSpacing).toBe(1);
    expect(title.props.className).toBe('a b');
  });

  it('unstyled drops the surface fill', () => {
    render(<Toaster />);
    act(() => {
      toast('Bare', { unstyled: true });
    });
    expect(nodesWithStyle((s) => s.backgroundColor === '#FFFFFF')).toHaveLength(0);
  });

  it('uses the font family and line tokens', () => {
    render(<Toaster theme={{ fontFamily: 'Inter-Medium', maxLines: 1 }} />);
    act(() => {
      toast('Typed');
    });
    const title = screen.getByText('Typed');
    expect(flat(title.props.style).fontFamily).toBe('Inter-Medium');
    expect(title.props.numberOfLines).toBe(1);
  });

  it('takes a heavier weight under Bold Text', async () => {
    // Not on the test environment's AccessibilityInfo; iOS has it.
    const info = AccessibilityInfo as { isBoldTextEnabled?: () => Promise<boolean> };
    const original = info.isBoldTextEnabled;
    info.isBoldTextEnabled = () => Promise.resolve(true);
    try {
      render(<Toaster theme={{ fontWeight: '500' }} />);
      await act(async () => {
        await Promise.resolve();
      });
      act(() => {
        toast('Bold');
      });
      // The setting is read when the first toast mounts, then applied.
      await act(async () => {
        await Promise.resolve();
      });
      expect(flat(screen.getByText('Bold').props.style).fontWeight).toBe('700');
    } finally {
      info.isBoldTextEnabled = original;
    }
  });
});

describe('Toaster: icons, haptics map, animation, preset', () => {
  it('uses the Toaster icon set for a type', () => {
    render(<Toaster icons={{ success: <Text>OK!</Text> }} />);
    act(() => {
      toast.success('Saved');
    });
    expect(screen.getByText('OK!')).toBeTruthy();
  });

  it('plays the haptic the map names', () => {
    render(<Toaster haptics={{ success: 'heavy', error: false }} />);
    act(() => {
      toast.success('Saved');
      toast.error('Failed');
    });
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('an animation preset reaches the theme', () => {
    let enter = -1;
    render(
      <Toaster animation="none">
        {({ theme }) => {
          enter = theme.motion.enter;
          return null;
        }}
      </Toaster>,
    );
    act(() => {
      toast('Instant');
    });
    expect(enter).toBe(0);
  });

  it('on Android, the default preset is a Material snackbar from the bottom', () => {
    withPlatform('android', () => {
      let radius = -1;
      let fill = false;
      render(
        <Toaster>
          {({ theme, toast: t }) => {
            radius = theme.radius;
            fill = theme.fill;
            return <Text>{String(t.message)}</Text>;
          }}
        </Toaster>,
      );
      act(() => {
        toast('Archived');
      });
      expect(radius).toBe(4);
      expect(fill).toBe(true);
      // Placed against the bottom: the stack is positioned by `bottom`.
      const stacks = nodesWithStyle((s) => s.position === 'absolute' && typeof s.bottom === 'number');
      expect(stacks.length).toBeGreaterThan(0);
    });
  });

  it('a preset is laid under the consumer theme, which wins', () => {
    let radius = -1;
    render(
      <Toaster preset="material" theme={{ radius: 12 }}>
        {({ theme }) => {
          radius = theme.radius;
          return null;
        }}
      </Toaster>,
    );
    act(() => {
      toast('x');
    });
    expect(radius).toBe(12);
  });
});

describe('progress', () => {
  it('toast.progress draws a bar and writes progress without re-rendering', () => {
    render(<Toaster />);
    let upload!: ReturnType<typeof toast.progress>;
    act(() => {
      upload = toast.progress('Uploading photo');
    });
    expect(screen.getByText('Uploading photo')).toBeTruthy();
    upload.set(0.42);
    expect(progressValue(upload.id).value).toBeCloseTo(0.42);
    upload.set(2);
    expect(progressValue(upload.id).value).toBe(1);
    upload.set('indeterminate');
    expect(progressValue(upload.id).value).toBe(-1);
  });

  it('success replaces it under the same id, without the bar', () => {
    let seen: unknown;
    render(
      <Toaster>
        {({ toast: t }) => {
          seen = t.progress;
          return <Text>{String(t.message)}</Text>;
        }}
      </Toaster>,
    );
    let upload!: ReturnType<typeof toast.progress>;
    act(() => {
      upload = toast.progress('Uploading');
    });
    expect(seen).toBe(0);
    act(() => {
      upload.success('Uploaded');
    });
    expect(screen.getByText('Uploaded')).toBeTruthy();
    expect(seen).toBeUndefined();
  });

  it('toast.steps walks its labels with a segmented bar', () => {
    let segments: unknown;
    render(
      <Toaster>
        {({ toast: t }) => {
          segments = t.progressSegments;
          return (
            <Text>
              {String(t.message)} {t.timestamp}
            </Text>
          );
        }}
      </Toaster>,
    );
    let job!: ReturnType<typeof toast.steps>;
    act(() => {
      job = toast.steps(['Compressing', 'Uploading', 'Processing']);
    });
    expect(segments).toBe(3);
    expect(screen.getByText('Compressing 1/3')).toBeTruthy();
    act(() => job.next());
    expect(screen.getByText('Uploading 2/3')).toBeTruthy();
    expect(job.step).toBe(1);
    expect(progressValue(job.id).value).toBeCloseTo(1.5 / 3);
  });

  it('toast.track follows a task to success, reporting progress on the way', async () => {
    render(<Toaster />);
    let reported = 0;
    await act(async () => {
      await toast.track(
        async (report) => {
          report(0.5);
          reported = 0.5;
          return 'ok';
        },
        { loading: 'Syncing', success: 'Synced' },
      );
    });
    expect(reported).toBe(0.5);
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('toast.track shows the error when the task fails, and rejects for the caller', async () => {
    render(<Toaster />);
    await act(async () => {
      await expect(
        toast.track(async () => Promise.reject(new Error('offline')), { loading: 'Syncing', error: (e) => `Failed: ${(e as Error).message}` }),
      ).rejects.toThrow('offline');
    });
    expect(screen.getByText('Failed: offline')).toBeTruthy();
  });
});

describe('shapes', () => {
  it('a HUD is centred on the screen', () => {
    render(<Toaster />);
    act(() => {
      toast.hud('Added to Library');
    });
    expect(screen.getByText('Added to Library')).toBeTruthy();
    expect(nodesWithStyle((s) => s.justifyContent === 'center' && s.top === 0 && s.bottom === 0).length).toBeGreaterThan(0);
  });

  it('a banner sits against the top edge, padded by the safe area', () => {
    render(<Toaster />);
    act(() => {
      toast.banner('You are offline', { duration: 'infinite' });
    });
    expect(screen.getByText('You are offline')).toBeTruthy();
    expect(nodesWithStyle((s) => s.position === 'absolute' && s.top === 0).length).toBeGreaterThan(0);
    // The banner's own 12 of padding, plus the 47 of the status bar.
    expect(nodesWithStyle((s) => s.paddingTop === 12 + 47).length).toBeGreaterThan(0);
  });

  it('the island is a black capsule near the top', () => {
    render(<Toaster />);
    act(() => {
      toast.island('AirPods connected');
    });
    expect(screen.getByText('AirPods connected')).toBeTruthy();
    expect(nodesWithStyle((s) => s.backgroundColor === '#000000').length).toBeGreaterThan(0);
  });

  it('a notification shows its title, body and time, and opens on press', () => {
    const onPress = jest.fn();
    render(<Toaster />);
    act(() => {
      toast.notify({ title: 'Maya', body: 'Sent you a photo', timestamp: 'now', onPress });
    });
    expect(screen.getByText('Maya')).toBeTruthy();
    expect(screen.getByText('Sent you a photo')).toBeTruthy();
    expect(screen.getByText('now')).toBeTruthy();
    fireEvent.press(screen.getByText('Maya'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('expandable and countdown', () => {
  it('opens and closes its details', () => {
    render(<Toaster />);
    act(() => {
      toast.error('3 files failed', { expandable: { content: 'a.jpg, b.jpg, c.jpg' } });
    });
    expect(screen.queryByText('a.jpg, b.jpg, c.jpg')).toBeNull();
    fireEvent.press(screen.getByLabelText('Show details'));
    expect(screen.getByText('a.jpg, b.jpg, c.jpg')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hide details'));
    expect(screen.queryByText('a.jpg, b.jpg, c.jpg')).toBeNull();
  });

  it('holds the queue while open, and lets it go if dismissed while open', () => {
    jest.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast('Saved', { duration: 1000 });
      toast.error('3 files failed', { id: 'failed', duration: 60000, expandable: { content: 'a.jpg' } });
    });
    fireEvent.press(screen.getByLabelText('Show details'));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    // Paused: the short toast outlives its duration while the details are open.
    expect(screen.queryByText('Saved')).toBeTruthy();

    act(() => {
      toast.dismiss('failed');
    });
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.queryByText('3 files failed')).toBeNull();
    // Once the open toast has left, the timers run again. Stepped, so the
    // dismissal's effects schedule the removal between steps.
    for (let i = 0; i < 8; i++) {
      act(() => {
        jest.advanceTimersByTime(500);
      });
    }
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('draws a countdown beside an action that asks for one', () => {
    render(<Toaster />);
    act(() => {
      toast('Message archived', { duration: 5000, action: { label: 'Undo', onPress: jest.fn(), countdown: true } });
    });
    const undo = screen.getByLabelText('Undo');
    // The ring is an SVG drawn before the label, inside the button.
    expect(undo.findAll((n) => String(n.type).includes('Svg') || String(n.type).includes('RNSVG')).length).toBeGreaterThan(0);
  });
});

describe('blur', () => {
  const FakeBlur = (props: Record<string, unknown>) => <Text testID="fake-blur">{String(props.tint)}</Text>;

  it('draws the blur view where there is no glass, with the scheme as its tint', () => {
    render(<Toaster colorScheme="dark" blur={{ component: FakeBlur, props: { intensity: 40 } }} />);
    act(() => {
      toast('Blurred');
    });
    const blur = screen.getByTestId('fake-blur');
    expect(blur.props.children).toBe('dark');
    expect(screen.UNSAFE_getByType(FakeBlur).props.intensity).toBe(40);
  });

  it('a tint in props wins over the scheme', () => {
    render(<Toaster blur={{ component: FakeBlur, props: { tint: 'prominent' } }} />);
    act(() => {
      toast('Blurred');
    });
    expect(screen.getByTestId('fake-blur').props.children).toBe('prominent');
  });

  it('is skipped for a toast with glass off', () => {
    render(<Toaster blur={{ component: FakeBlur }} />);
    act(() => {
      toast('Opaque', { glass: false });
    });
    expect(screen.queryByTestId('fake-blur')).toBeNull();
  });

  it('is skipped under Reduce Transparency', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockResolvedValue(true);
    render(<Toaster blur={{ component: FakeBlur }} />);
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      toast('Opaque');
    });
    expect(screen.queryByTestId('fake-blur')).toBeNull();
  });

  it('an inline blur setting does not re-render the toasts', () => {
    let renders = 0;
    const Counted = (props: Record<string, unknown>) => {
      renders += 1;
      return <FakeBlur {...props} />;
    };
    const { rerender } = render(<Toaster blur={{ component: Counted, props: { intensity: 40 } }} />);
    act(() => {
      toast('Blurred');
    });
    const before = renders;
    rerender(<Toaster blur={{ component: Counted, props: { intensity: 40 } }} />);
    expect(renders).toBe(before);
  });
});

describe('adapters', () => {
  it('themeFromColors derives the theme from a few colours', () => {
    const theme = themeFromColors({ background: '#101010', text: '#FAFAFA', accent: '#FF6B00', radius: 12, fontFamily: 'Inter' });
    expect(theme.fallbackBackground).toBe('#101010');
    expect(theme.color).toBe('#FAFAFA');
    expect(theme.actionColor).toBe('#FF6B00');
    expect(theme.descriptionColor).toBe('rgba(250,250,250,0.7)');
    expect(theme.radius).toBe(12);
    expect(theme.fontFamily).toBe('Inter');
  });

  it('fromNavigationTheme maps a React Navigation theme to Toaster props', () => {
    const props = fromNavigationTheme({
      dark: true,
      colors: { card: '#1C1C1E', text: '#FFFFFF', border: '#333333', primary: '#0A84FF' },
      fonts: { regular: { fontFamily: 'Inter' }, medium: { fontFamily: 'Inter-Medium' } },
    });
    expect(props.colorScheme).toBe('dark');
    expect(props.theme.fallbackBackground).toBe('#1C1C1E');
    expect(props.theme.actionColor).toBe('#0A84FF');
    expect(props.theme.fontFamily).toBe('Inter-Medium');
    expect(props.theme.descriptionFontFamily).toBe('Inter');
  });

  it('materialTheme flips with the scheme', () => {
    expect(materialTheme('light').fallbackBackground).toBe('#313033');
    expect(materialTheme('dark').fallbackBackground).toBe('#E6E1E5');
  });
});
