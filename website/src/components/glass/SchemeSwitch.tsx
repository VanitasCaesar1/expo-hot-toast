import { useState } from 'react';
import '../glassyui/styles/liquid.css';
import { GlassSegmentedControl, GlassSegmentedControlItem } from '../glassyui/glass-segmented-control';

/**
 * Dark or light recordings, as a Glassy UI segmented control. The recordings
 * belong to DemoWindow.astro's script, which listens for `demo:scheme`.
 */
export default function SchemeSwitch() {
  const [scheme, setScheme] = useState('dark');
  return (
    <GlassSegmentedControl
      value={scheme}
      aria-label="Appearance of the recordings"
      onValueChange={(value) => {
        setScheme(value);
        window.dispatchEvent(new CustomEvent('demo:scheme', { detail: value }));
      }}
    >
      <GlassSegmentedControlItem value="dark">Dark</GlassSegmentedControlItem>
      <GlassSegmentedControlItem value="light">Light</GlassSegmentedControlItem>
    </GlassSegmentedControl>
  );
}
