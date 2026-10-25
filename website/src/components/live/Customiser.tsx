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

export default function Customiser() {
  const config = useLiveConfig();
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [blur, setBlur] = useState(DEFAULT_BLUR);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [tint, setTint] = useState<string | undefined>(undefined);

  const glassOn = config.glass !== false;
  const options = config.toastOptions ?? {};
  const rich = options.richColors === true;
  const closeButton = options.closeButton === true;

  const setTheme = (next: { radius?: number; frostBlur?: number }) => {
    const theme = { radius, frostBlur: blur, ...next };
    configure({ theme: { radius: theme.radius, frostBlur: theme.frostBlur } });
  };
  const setOptions = (next: Record<string, unknown>) => configure({ toastOptions: { ...options, ...next } });
  const setGlass = (on: boolean, tintColor = tint) => configure({ glass: on ? (tintColor ? { tintColor } : true) : false });

  const props: string[] = [`  colorScheme="${config.colorScheme ?? 'dark'}"`];
  if (config.position && config.position !== 'top-center') props.push(`  position="${config.position}"`);
  if (config.stacked) props.push('  stacked');
  if (!glassOn) props.push('  glass={false}');
  else if (tint) props.push(`  glass={{ tintColor: '${tint}' }}`);
  const theme = [radius !== DEFAULT_RADIUS && `radius: ${radius}`, blur !== DEFAULT_BLUR && `frostBlur: ${blur}`].filter(Boolean);
  if (theme.length) props.push(`  theme={{ ${theme.join(', ')} }}`);
  const toastOptions = [
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
            value={config.colorScheme ?? 'dark'}
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
