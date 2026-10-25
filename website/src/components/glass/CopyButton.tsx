import { useState } from 'react';
import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassButton } from '../glassyui/glass-button';
import type { ButtonVariant, ButtonSize } from '../glassyui/glass-button';
import { Glyph } from './icons';

interface Props {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Only the glyph, with `label` as its accessible name. */
  iconOnly?: boolean;
  className?: string;
}

/** A Glassy UI button that copies `text`. */
export default function CopyButton({ text, label, copiedLabel = 'Copied', variant = 'soft', size = 'md', iconOnly, className }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <GlassButton
      variant={variant}
      size={size}
      className={className}
      aria-label={iconOnly ? label : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard unavailable (insecure context); the text stays selectable.
        }
      }}
    >
      <Glyph name={copied ? 'check' : 'copy'} />
      {!iconOnly && <span className="button-label">{copied ? copiedLabel : label}</span>}
    </GlassButton>
  );
}
