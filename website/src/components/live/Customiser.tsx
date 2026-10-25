import './live.css';
import { useState } from 'react';
import { GlassButton } from '../glassyui/glass-button';
import { GlassSwitch } from '../glassyui/glass-switch';
import { GlassSlider } from '../glassyui/glass-slider';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../glassyui/glass-segmented-control';
import { LiveCode } from './code';
import { useLiveConfig } from './use-live';
import { configure, withToast } from '../../lib/live';

/** The library's defaults, so the code shows only what you changed. */
const DEFAULT_RADIUS = 22;
const DEFAULT_BLUR = 18;
const DEFAULT_DURATION = 4000;

const tints = [
  { name: 'None', value: undefined, swatch: 'transparent' },
  { name: 'Amber', value: 'rgba(255,149,0,0.32)', swatch: '#ff9500' },
  { name: 'Blue', value: 'rgba(10,132,255,0.3)', swatch: '#0a84ff' },
  { name: 'Green', value: 'rgba(48,209,88,0.3)', swatch: '#30d158' },
  { name: 'Pink', value: 'rgba(255,55,95,0.3)', swatch: '#ff375f' },
];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const FONTS = {
  system: undefined,
  serif: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;
type FontName = keyof typeof FONTS;

/** An outline icon set, to show the `icons` prop. Phosphor-style, 22px. */
const outline = (d: string, color: string) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const OUTLINE_ICONS = {
  success: outline('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-4-9 2.8 2.8L16.5 9', '#30d158'),
  error: outline('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6m0-6-6 6', '#ff453a'),
  info: outline('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-4.5M12 8h.01', '#0a84ff'),
  warning: outline('M12 3 2.5 19.5h19L12 3Zm0 6.5v4M12 16.5h.01', '#ff9f0a'),
};

type Shape = 'pill' | 'card' | 'hud' | 'island';

/** A short run that shows every surface the settings touch. */
function sample() {
  withToast((toast) => {
    toast.success('Changes saved', { description: 'Synced to all your devices.' });
    setTimeout(() => toast.error('Could not reach the server'), 350);
    setTimeout(() => {
      void toast.promise(wait(1500), { loading: 'Uploading photo…', success: 'Photo uploaded', error: 'Upload failed' });
    }, 700);
  });
}

/** One toast that updates in place while you drag. */
function preview() {
  withToast((toast) => toast.success('Looking good', { id: 'preview' }));
}

/** A toast in the chosen shape. */
function fireShape(shape: Shape) {
  withToast((toast, api) => {
    if (shape === 'card') api.examples.notify?.({ duration: 3600 });
    else if (shape === 'hud') toast.hud('Added to Library');
    else if (shape === 'island') toast.island('AirPods Pro connected', { type: 'success' });
    else toast.success('Changes saved');
  });
}

export default function Customiser() {
  const config = useLiveConfig();
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [blur, setBlur] = useState(DEFAULT_BLUR);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [tint, setTint] = useState<string | undefined>(undefined);
  const [font, setFont] = useState<FontName>('system');
  const [iconSet, setIconSet] = useState<'built-in' | 'outline'>('built-in');
  const [ownCss, setOwnCss] = useState(false);
  const [shape, setShape] = useState<Shape>('pill');
  const preset = config.preset ?? 'auto';
  const animation = config.animation ?? 'hot';

  const glassOn = config.glass !== false;
  const options = config.toastOptions ?? {};
  const rich = options.richColors === true;
  const closeButton = options.closeButton === true;

  const setTheme = (next: { radius?: number; frostBlur?: number; fontFamily?: string }) => {
    const theme = { radius, frostBlur: blur, fontFamily: FONTS[font], ...next };
    configure({ theme: { radius: theme.radius, frostBlur: theme.frostBlur, fontFamily: theme.fontFamily } });
  };
  const setOptions = (next: Record<string, unknown>) => configure({ toastOptions: { ...options, ...next } });
  const setGlass = (on: boolean, tintColor = tint) => configure({ glass: on ? (tintColor ? { tintColor } : true) : false });

  const props: string[] = [`  colorScheme="${config.colorScheme ?? 'light'}"`];
  if (preset === 'material') props.push('  preset="material"');
  if (animation !== 'hot') props.push(`  animation="${animation}"`);
  if (iconSet === 'outline') props.push('  icons={{ success: <CheckCircle />, error: <XCircle />, info: <Info />, warning: <Warning /> }}');
  if (config.position && config.position !== 'top-center') props.push(`  position="${config.position}"`);
  if (config.stacked) props.push('  stacked');
  if (!glassOn) props.push('  glass={false}');
  else if (tint) props.push(`  glass={{ tintColor: '${tint}' }}`);
  const theme = [
    radius !== DEFAULT_RADIUS && `radius: ${radius}`,
    blur !== DEFAULT_BLUR && `frostBlur: ${blur}`,
    font !== 'system' && `fontFamily: '${font === 'serif' ? 'Georgia' : 'Menlo'}'`,
  ].filter(Boolean);
  if (theme.length) props.push(`  theme={{ ${theme.join(', ')} }}`);
  const toastOptions = [
    ownCss && "unstyled: true, classNames: { toast: 'my-toast', title: 'my-title' }",
    rich && 'richColors: true',
    closeButton && 'closeButton: true',
    duration !== DEFAULT_DURATION && `duration: ${duration}`,
  ].filter(Boolean);
  if (toastOptions.length) props.push(`  toastOptions={{ ${toastOptions.join(', ')} }}`);
  const code = `<Toaster\n${props.join('\n')}\n/>`;

  return (
    <div className="customiser">
      <div className="controls">
        <div className="control">
          <span className="control-label">Appearance</span>
          <GlassSegmentedControl
            value={config.colorScheme ?? 'light'}
            onValueChange={(value) => {
              configure({ colorScheme: value as 'light' | 'dark' });
              preview();
            }}
            aria-label="Appearance"
          >
            <GlassSegmentedControlItem value="light">Light</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="dark">Dark</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>

        <div className="control">
          <span className="control-label">Preset</span>
          <GlassSegmentedControl
            value={preset === 'material' ? 'material' : 'glass'}
            onValueChange={(value) => {
              configure({ preset: value as 'glass' | 'material' });
              sample();
            }}
            aria-label="Preset"
          >
            <GlassSegmentedControlItem value="glass">Glass</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="material">Material</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>

        <div className="control control-wide">
          <span className="control-label">Animation</span>
          <GlassSegmentedControl
            value={animation}
            onValueChange={(value) => {
              configure({ animation: value as typeof animation });
              sample();
            }}
            aria-label="Animation"
          >
            {(['hot', 'slide', 'fade', 'pop', 'none'] as const).map((a) => (
              <GlassSegmentedControlItem key={a} value={a}>
                {a[0]!.toUpperCase() + a.slice(1)}
              </GlassSegmentedControlItem>
            ))}
          </GlassSegmentedControl>
        </div>

        <div className="control">
          <span className="control-label">Icons</span>
          <GlassSegmentedControl
            value={iconSet}
            onValueChange={(value) => {
              const next = value as typeof iconSet;
              setIconSet(next);
              configure({ icons: next === 'outline' ? OUTLINE_ICONS : undefined });
              withToast((toast) => {
                toast.success('Changes saved');
                setTimeout(() => toast.warning('Storage almost full'), 300);
              });
            }}
            aria-label="Icons"
          >
            <GlassSegmentedControlItem value="built-in">Built-in</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="outline">Your own</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>

        <div className="control">
          <span className="control-label">Font</span>
          <GlassSegmentedControl
            value={font}
            onValueChange={(value) => {
              const next = value as FontName;
              setFont(next);
              setTheme({ fontFamily: FONTS[next] });
              preview();
            }}
            aria-label="Font"
          >
            <GlassSegmentedControlItem value="system">System</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="serif">Serif</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="mono">Mono</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>

        <div className="control control-wide">
          <span className="control-label">Shape</span>
          <GlassSegmentedControl
            value={shape}
            onValueChange={(value) => {
              const next = value as Shape;
              setShape(next);
              fireShape(next);
            }}
            aria-label="Shape"
          >
            <GlassSegmentedControlItem value="pill">Pill</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="card">Card</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="hud">HUD</GlassSegmentedControlItem>
            <GlassSegmentedControlItem value="island">Island</GlassSegmentedControlItem>
          </GlassSegmentedControl>
        </div>

        <div className="control">
          <span className="control-label">Glass tint</span>
          <div className="swatches" role="radiogroup" aria-label="Glass tint">
            {tints.map((t) => (
              <button
                key={t.name}
                type="button"
                role="radio"
                aria-checked={tint === t.value}
                aria-label={t.name}
                title={t.name}
                className="swatch"
                style={{ '--swatch': t.swatch } as React.CSSProperties}
                disabled={!glassOn}
                onClick={() => {
                  setTint(t.value);
                  setGlass(true, t.value);
                  preview();
                }}
              />
            ))}
          </div>
        </div>

        <div className="control">
          <span className="control-label">
            Corner radius <output>{radius}</output>
          </span>
          <GlassSlider
            aria-label="Corner radius"
            min={0}
            max={32}
            step={1}
            value={[radius]}
            onValueChange={([value]) => {
              setRadius(value);
              setTheme({ radius: value });
            }}
            onValueCommit={preview}
          />
        </div>

        <div className="control">
          <span className="control-label">
            Glass blur <output>{blur}px</output>
          </span>
          <GlassSlider
            aria-label="Glass blur"
            min={0}
            max={40}
            step={1}
            value={[blur]}
            disabled={!glassOn}
            onValueChange={([value]) => {
              setBlur(value);
              setTheme({ frostBlur: value });
            }}
            onValueCommit={preview}
          />
        </div>

        <div className="control">
          <span className="control-label">
            Duration <output>{(duration / 1000).toFixed(1)}s</output>
          </span>
          <GlassSlider
            aria-label="Duration"
            min={1000}
            max={10000}
            step={500}
            value={[duration]}
            onValueChange={([value]) => {
              setDuration(value);
              setOptions({ duration: value });
            }}
          />
        </div>

        <div className="switches">
          <label className="switch-row">
            <GlassSwitch
              checked={glassOn}
              onCheckedChange={(on) => {
                setGlass(on);
                preview();
              }}
            />
            <span>Glass</span>
          </label>
          <label className="switch-row">
            <GlassSwitch
              checked={rich}
              onCheckedChange={(on) => {
                setOptions({ richColors: on });
                withToast((toast) => {
                  toast.success('Payment received');
                  setTimeout(() => toast.error('Card declined'), 300);
                });
              }}
            />
            <span>Rich colours</span>
          </label>
          <label className="switch-row">
            <GlassSwitch
              checked={config.stacked === true}
              onCheckedChange={(on) => {
                configure({ stacked: on });
                sample();
              }}
            />
            <span>Stacked</span>
          </label>
          <label className="switch-row">
            <GlassSwitch
              checked={ownCss}
              onCheckedChange={(on) => {
                setOwnCss(on);
                setOptions(on ? { unstyled: true, classNames: { toast: 'my-toast', title: 'my-title' } } : { unstyled: undefined, classNames: undefined });
                preview();
              }}
            />
            <span>Your own CSS</span>
          </label>
          <label className="switch-row">
            <GlassSwitch
              checked={closeButton}
              onCheckedChange={(on) => {
                setOptions({ closeButton: on });
                preview();
              }}
            />
            <span>Close button</span>
          </label>
        </div>

        <GlassButton lens={false} variant="primary" size="lg" className="fire" onClick={sample}>
          Fire a few toasts
        </GlassButton>
      </div>

      <LiveCode code={code} file="App.tsx" />
    </div>
  );
}
