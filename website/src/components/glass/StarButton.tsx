import { useEffect, useState } from 'react';
import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassButton } from '../glassyui/glass-button';
import type { ButtonVariant, ButtonSize } from '../glassyui/glass-button';
import { Glyph } from './icons';
import { formatStars, liveStars } from '../../lib/stars';

interface Props {
  repo: string;
  /** The count at build time, shown until the live one arrives. */
  initial?: number;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Hides the label on phones, keeping the star and the count. */
  compact?: boolean;
  className?: string;
}

/**
 * Star on GitHub, with the live star count once there is one to show. On the
 * homepage, where the library runs, it also says thank you with a real toast.
 */
export default function StarButton({ repo, initial, label = 'Star', variant = 'soft', size = 'md', compact, className }: Props) {
  const [stars, setStars] = useState(initial);
  useEffect(() => {
    let active = true;
    void liveStars().then((count) => {
      if (active && typeof count === 'number') setStars(count);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <GlassButton asChild variant={variant} size={size} className={className ? `star-button ${className}` : 'star-button'}>
      <a
        href={repo}
        target="_blank"
        rel="noopener"
        data-compact={compact ? '' : undefined}
        aria-label={stars ? `${label} on GitHub, ${stars} stars` : `${label} on GitHub`}
        onClick={() =>
          window.expoHotToast?.toast('Thank you for the star!', { icon: '⭐', id: 'star-thanks' })
        }
      >
        <Glyph name="star" />
        <span className="button-label">{label}</span>
        {typeof stars === 'number' && stars > 0 && <span className="star-count">{formatStars(stars)}</span>}
      </a>
    </GlassButton>
  );
}
