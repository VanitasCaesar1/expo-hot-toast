import { useEffect, useState } from 'react';
import { getScheme, onScheme } from '../../lib/theme';
import '../glassyui/styles/liquid.css';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../glassyui/glass-segmented-control';

/**
 * Dark or light recordings, as a Glassy UI segmented control. The recordings
 * belong to DemoWindow.astro's script, which listens for `demo:scheme`.
 */
export default function SchemeSwitch() {
  const [scheme, setScheme] = useState('dark');
  const show = (value: string) => {
    setScheme(value);
    window.dispatchEvent(new CustomEvent('demo:scheme', { detail: value }));
  };
  // The recordings start in, and follow, the site's theme.
  useEffect(() => {
    if (getScheme() === 'light') show('light');
    return onScheme(show);
  }, []);
  return (
    <GlassSegmentedControl
      value={scheme}
      aria-label="Appearance of the recordings"
      onValueChange={show}
    >
      <GlassSegmentedControlItem value="dark">Dark</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="light">Light</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}
