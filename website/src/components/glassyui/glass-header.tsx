'use client';

import clsx from 'clsx';
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode, RefObject } from 'react';
import {
  createFrameLoop,
  createSpring,
  motionReduced,
  retuneSpring,
  stepSpring,
} from './lib/liquid-motion';
import { mergeRefs } from './lib/merge-refs';
import { GlassSurface } from './glass-surface';
import './styles/header.css';

export type GlassHeaderProps = HTMLAttributes<HTMLElement> & {
  /** A wordmark or logo, usually linked to the home page. */
  brand: ReactNode;
  /** Buttons or links at the end of the capsule. */
  actions?: ReactNode;
  /**
   * Opens out across the top of the page without glass, and condenses into the capsule once
   * the page scrolls. Fixed headers only.
   */
  condenseOnScroll?: boolean;
  /** Accessible name for the desktop and mobile navigation. */
  navigationLabel?: string;
  /** Fixed above the page by default; static keeps it in the surrounding layout. */
  position?: 'fixed' | 'static';
};

// The header condenses once the page has scrolled past this many CSS pixels, and opens again
// only when it is back at the top, so it never flickers on the threshold.
const CONDENSE_AFTER = 8;

const OPEN_WITHIN = 1;

type Feel = readonly [response: number, bounce: number];

// Condensing, the glass forms at once, before a fast scroll can carry the page under bare
// links, and the capsule gathers in behind it, settling with a slight squeeze. Opening, the bar
// spreads out without overshoot while its glass thins a little more slowly, so the material is
// seen to stretch before it goes.
const GATHER: Feel = [0.56, 0.22];

const FORM: Feel = [0.24, 0];

const SPREAD: Feel = [0.44, 0];

const THIN: Feel = [0.5, 0];

/**
 * Springs the header between the open bar at the top of the page and the capsule. It writes
 * --lg-header-spread (1 open, 0 capsule) and --lg-header-material (0 no glass, 1 glass) while
 * it moves; at rest the data-condensed state sets both. Reduced motion jumps. Until this runs,
 * the state is unknown and CSS follows the scroll position on its own.
 */
function useCondensing(headerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [condensed, setCondensed] = useState<boolean | null>(null);
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const header = headerRef.current;

    if (!enabled || !header) return;

    const spread = createSpring(...SPREAD, 1);
    const material = createSpring(...THIN, 0);
    let target: boolean | null = null;

    const paint = () => {
      header.style.setProperty('--lg-header-spread', spread.value.toFixed(4));
      header.style.setProperty(
        '--lg-header-material',
        Math.min(Math.max(material.value, 0), 1).toFixed(4),
      );
    };

    const clear = () => {
      header.style.removeProperty('--lg-header-spread');
      header.style.removeProperty('--lg-header-material');
    };

    const loop = createFrameLoop((dt) => {
      const reduced = motionReduced();
      const spreading = stepSpring(spread, dt, reduced);
      const forming = stepSpring(material, dt, reduced);

      if (spreading || forming) {
        paint();

        return true;
      }

      clear();
      setMoving(false);

      return false;
    });

    const update = (animate: boolean) => {
      const scrolled = window.scrollY;
      const next = target ? scrolled > OPEN_WITHIN : scrolled > CONDENSE_AFTER;

      if (next === target) return;

      target = next;
      spread.target = next ? 0 : 1;
      material.target = next ? 1 : 0;
      retuneSpring(spread, ...(next ? GATHER : SPREAD));
      retuneSpring(material, ...(next ? FORM : THIN));
      setCondensed(next);

      if (animate && !motionReduced()) {
        // A jump or a fling can carry the page further than the header reaches before it
        // condenses. The glass is then there at once, so the links never sit bare on content;
        // only the shape gathers in.
        if (next && scrolled > header.getBoundingClientRect().bottom) {
          material.value = 1;
          material.velocity = 0;
        }

        // Pins the current shape inline before the new state's values apply.
        paint();
        setMoving(true);
        loop.start();

        return;
      }

      loop.stop();

      for (const spring of [spread, material]) {
        spring.value = spring.target;
        spring.velocity = 0;
      }

      clear();
      setMoving(false);
    };

    // A page that opens partway down, or returns there, starts condensed without moving.
    update(false);

    const onScroll = () => update(true);

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      loop.stop();
      clear();
      setMoving(false);
    };
  }, [enabled, headerRef]);

  return { condensed, moving };
}

export const GlassHeader = forwardRef<HTMLElement, GlassHeaderProps>(
  (
    {
      brand,
      actions,
      children,
      className,
      condenseOnScroll = false,
      navigationLabel = 'Primary',
      position = 'fixed',
      ...rest
    },
    forwardedRef,
  ) => {
    const headerRef = useRef<HTMLElement | null>(null);
    const ref = useMemo(() => mergeRefs(headerRef, forwardedRef), [forwardedRef]);
    const condensing = condenseOnScroll && position === 'fixed';
    const { condensed, moving } = useCondensing(headerRef, condensing);

    return (
      <header
        ref={ref}
        className={clsx('lg-header', className)}
        data-condense-on-scroll={condensing ? '' : undefined}
        data-condensed={condensing && condensed !== null ? String(condensed) : undefined}
        data-position={position}
        {...rest}
      >
        {/* The lens map is drawn for one size, so a condensing header bends light only once its
            capsule has settled; it frosts while the shape moves. */}
        <GlassSurface
          aria-hidden
          className="lg-header-glass"
          lens={!condensing || (condensed === true && !moving)}
          preset="standard"
        />
        <div className="lg-header-bar">
          <div className="lg-header-brand">{brand}</div>
          {children ? (
            <>
              <nav aria-label={navigationLabel} className="lg-header-links lg-header-desktop">
                {children}
              </nav>
              <details
                className="lg-header-menu"
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && event.currentTarget.open) {
                    event.preventDefault();
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector('summary')?.focus();
                  }
                }}
              >
                <summary>Menu</summary>
                <nav
                  aria-label={navigationLabel}
                  className="lg-header-links lg-header-menu-links"
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest('a[href]')) {
                      const menu = event.currentTarget.closest('details');

                      if (menu) {
                        menu.open = false;
                        menu.querySelector('summary')?.focus();
                      }
                    }
                  }}
                >
                  {children}
                </nav>
              </details>
            </>
          ) : null}
          {actions ? <div className="lg-header-actions">{actions}</div> : null}
        </div>
      </header>
    );
  },
);

GlassHeader.displayName = 'GlassHeader';
