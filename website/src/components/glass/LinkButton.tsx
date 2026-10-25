import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassButton } from '../glassyui/glass-button';
import type { ButtonVariant, ButtonSize } from '../glassyui/glass-button';
import { Glyph } from './icons';
import type { GlyphName } from './icons';

interface Props {
  href: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Glyph before the label. */
  icon?: GlyphName;
  /** Glyph after the label. */
  trailing?: GlyphName;
  /** Shows only the glyph on narrow screens. */
  compact?: boolean;
  className?: string;
}

/** A link drawn as a Glassy UI button. */
export default function LinkButton({ href, label, variant = 'soft', size = 'md', icon, trailing, compact, className }: Props) {
  return (
    <GlassButton asChild variant={variant} size={size} className={className}>
      <a href={href} aria-label={compact ? label : undefined} data-compact={compact ? '' : undefined}>
        {icon && <Glyph name={icon} />}
        <span className="button-label">{label}</span>
        {trailing && <Glyph name={trailing} />}
      </a>
    </GlassButton>
  );
}
