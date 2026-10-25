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

/**
 * A Glassy UI button that copies `text`. Rendered without hydration: Base.astro's
 * delegated handler copies on click and sets data-copied, which swaps the label.
 */
export default function CopyButton({ text, label, copiedLabel = 'Copied', variant = 'soft', size = 'md', iconOnly, className }: Props) {
  return (
    <GlassButton
      variant={variant}
      size={size}
      className={className ? `copy-button ${className}` : 'copy-button'}
      aria-label={iconOnly ? label : undefined}
      data-copy={text}
    >
      <span className="copy-idle">
        <Glyph name="copy" />
        {!iconOnly && <span className="button-label">{label}</span>}
      </span>
      <span className="copy-done">
        <Glyph name="check" />
        {!iconOnly && <span className="button-label">{copiedLabel}</span>}
      </span>
    </GlassButton>
  );
}
