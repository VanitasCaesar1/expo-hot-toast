import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassPanel } from '../glassyui/glass-panel';
import CopyButton from './CopyButton';

/** A shell command on a glass pill, with a copy button. */
export default function CommandBox({ command }: { command: string }) {
  return (
    <GlassPanel variant="pill" preset="control" className="command-box">
      <code>
        <span className="prompt">$</span> {command}
      </code>
      <CopyButton text={command} label="Copy install command" iconOnly variant="ghost" size="sm" />
    </GlassPanel>
  );
}
