import { useEffect, useState } from 'react';
import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassButton } from '../glassyui/glass-button';
import { Glyph } from './icons';
import { getPref, setPref, watchSystem } from '../../lib/theme';
import type { ThemePref } from '../../lib/theme';

const ORDER: ThemePref[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemePref, string> = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' };
const GLYPH = { system: 'monitor', light: 'sun', dark: 'moon' } as const;

/** Cycles the site through system, light and dark. */
export default function ThemeToggle({ className }: { className?: string }) {
  // The server cannot know the visitor's choice; it renders 'system' and the
  // first effect corrects it.
  const [pref, setLocal] = useState<ThemePref>('system');
  useEffect(() => {
    setLocal(getPref());
    watchSystem();
  }, []);
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  return (
    <GlassButton
      variant="soft"
      size="sm"
      lens={false}
      className={className ? `theme-toggle ${className}` : 'theme-toggle'}
      aria-label={`${LABEL[pref]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={LABEL[pref]}
      onClick={() => {
        setPref(next);
        setLocal(next);
      }}
    >
      <Glyph name={GLYPH[pref]} />
    </GlassButton>
  );
}
