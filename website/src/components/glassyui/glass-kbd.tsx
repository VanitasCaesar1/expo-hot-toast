import clsx from 'clsx';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

/** A keycap. Put one key, or a symbol such as ⌘, in each. */
export const GlassKbd = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, forwardedRef) => (
    <kbd {...props} ref={forwardedRef} className={clsx('lg-kbd', className)} />
  ),
);

GlassKbd.displayName = 'GlassKbd';

/** Sets a shortcut's keys side by side. */
export const GlassKbdGroup = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, forwardedRef) => (
    <span {...props} ref={forwardedRef} className={clsx('lg-kbd-group', className)} />
  ),
);

GlassKbdGroup.displayName = 'GlassKbdGroup';
