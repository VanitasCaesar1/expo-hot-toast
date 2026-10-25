'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command as CommandPrimitive, useCommandState } from 'cmdk';
import clsx from 'clsx';
import { forwardRef, useCallback, useRef } from 'react';
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { GlassPanel } from './glass-panel';

const radixSlotProps = { asChild: true };

// cmdk scrolls during selection even when a menu mounts outside the viewport.
// Guard only its own result/heading nodes; leave every other scroll method alone.
function useCommandScrollRef(
  forwardedRef: Ref<HTMLDivElement> | undefined,
  target: 'item' | 'heading',
  heading?: ReactNode,
) {
  const detach = useRef<(() => void) | null>(null);

  return useCallback(
    (node: HTMLDivElement | null) => {
      detach.current?.();
      detach.current = null;

      if (!node) return;

      const element =
        target === 'item'
          ? node
          : heading === undefined
            ? null
            : node.querySelector<HTMLElement>(':scope > [cmdk-group-heading]');

      let restore: (() => void) | undefined;

      if (element) {
        const descriptor = Object.getOwnPropertyDescriptor(element, 'scrollIntoView');
        const original = element.scrollIntoView;

        const scrollIntoView = (options?: boolean | ScrollIntoViewOptions) => {
          if (element.closest('[cmdk-root]')?.contains(element.ownerDocument.activeElement)) {
            original.call(element, options);
          }
        };

        Object.defineProperty(element, 'scrollIntoView', {
          configurable: true,
          enumerable: descriptor?.enumerable ?? false,
          value: scrollIntoView,
          writable: true,
        });
        restore = () => {
          if (element.scrollIntoView !== scrollIntoView) return;

          if (descriptor) Object.defineProperty(element, 'scrollIntoView', descriptor);
          else Reflect.deleteProperty(element, 'scrollIntoView');
        };
      }

      let refCleanup: (() => void) | void;
      detach.current = () => {
        restore?.();

        if (refCleanup) refCleanup();
        else if (forwardedRef) {
          if ('current' in forwardedRef) forwardedRef.current = null;
          else forwardedRef(null);
        }
      };

      if (forwardedRef) {
        if ('current' in forwardedRef) forwardedRef.current = node;
        else refCleanup = forwardedRef(node);
      }
    },
    [forwardedRef, target, heading],
  );
}

/**
 * A searchable list with arrow-key navigation. Typing filters the items; Enter runs the one
 * that is highlighted. Built on cmdk, so its props (`filter`, `shouldFilter`, `loop`) apply.
 */
export const GlassCommand = forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, forwardedRef) => (
  <CommandPrimitive {...props} ref={forwardedRef} className={clsx('lg-command', className)} />
));

GlassCommand.displayName = 'GlassCommand';

export type GlassCommandDialogProps = React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Root
> & {
  className?: string;
  /** Names the dialog for assistive technology. It is not shown. */
  title?: string;
};

/** A command list in a dialog near the top of the page, the way a launcher opens. */
export function GlassCommandDialog({
  children,
  className,
  title = 'Command menu',
  ...props
}: GlassCommandDialogProps) {
  // A launcher opens from anywhere, often a shortcut, so it hands focus back to whatever had it.
  const openedFrom = useRef<HTMLElement | null>(null);

  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="lg-dialog-overlay" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          {...radixSlotProps}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openedFrom.current?.focus();
            openedFrom.current = null;
          }}
          onOpenAutoFocus={() => {
            openedFrom.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
        >
          <GlassPanel
            className={clsx('lg-dialog-content lg-command-dialog', className)}
            elevation="raised"
            lens
            preset="prominent"
            refraction="none"
            variant="panel"
          >
            <DialogPrimitive.Title className="lg-visually-hidden">{title}</DialogPrimitive.Title>
            {children}
          </GlassPanel>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const GlassCommandInput = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, forwardedRef) => (
  <div className="lg-command-search">
    <svg aria-hidden viewBox="0 0 20 20">
      <circle cx="9" cy="9" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m13 13 3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
    <CommandPrimitive.Input
      {...props}
      ref={forwardedRef}
      className={clsx('lg-command-input', className)}
    />
  </div>
));

GlassCommandInput.displayName = 'GlassCommandInput';

export const GlassCommandList = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, forwardedRef) => (
  <CommandPrimitive.List
    {...props}
    ref={forwardedRef}
    className={clsx('lg-command-list', className)}
  />
));

GlassCommandList.displayName = 'GlassCommandList';

export const GlassCommandEmpty = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, forwardedRef) => (
  <CommandPrimitive.Empty
    {...props}
    ref={forwardedRef}
    className={clsx('lg-command-empty', className)}
  />
));

GlassCommandEmpty.displayName = 'GlassCommandEmpty';

export const GlassCommandGroup = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, heading, ...props }, forwardedRef) => {
  const ref = useCommandScrollRef(forwardedRef, 'heading', heading);

  return (
    <CommandPrimitive.Group
      {...props}
      ref={ref}
      heading={heading}
      className={clsx('lg-command-group', className)}
    />
  );
});

GlassCommandGroup.displayName = 'GlassCommandGroup';

export const GlassCommandItem = forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, forwardedRef) => {
  const ref = useCommandScrollRef(forwardedRef, 'item');

  return (
    <CommandPrimitive.Item {...props} ref={ref} className={clsx('lg-command-item', className)} />
  );
});

GlassCommandItem.displayName = 'GlassCommandItem';

export type GlassCommandSeparatorProps = HTMLAttributes<HTMLDivElement> & {
  /** Keeps the line while a search is typed. By default it goes, as the groups it divides fold. */
  alwaysRender?: boolean;
};

/**
 * A divider between groups. It is decorative and hidden from assistive technology, because a
 * listbox may own only options and groups.
 */
export const GlassCommandSeparator = forwardRef<HTMLDivElement, GlassCommandSeparatorProps>(
  ({ alwaysRender = false, className, ...props }, forwardedRef) => {
    const idle = useCommandState((state) => !state.search);

    if (!alwaysRender && !idle) return null;

    return (
      <div
        {...props}
        ref={forwardedRef}
        aria-hidden
        className={clsx('lg-command-separator', className)}
      />
    );
  },
);

GlassCommandSeparator.displayName = 'GlassCommandSeparator';

/** A shortcut hint, pushed to the end of the item. Put `GlassKbd` keys inside. */
export const GlassCommandShortcut = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, forwardedRef) => (
    <span {...props} ref={forwardedRef} className={clsx('lg-command-shortcut', className)} />
  ),
);

GlassCommandShortcut.displayName = 'GlassCommandShortcut';
