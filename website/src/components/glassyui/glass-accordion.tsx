'use client';

import * as AccordionPrimitive from '@radix-ui/react-accordion';
import clsx from 'clsx';
import { GlassPanel } from './glass-panel';

const radixSlotProps = { asChild: true };

export const GlassAccordion = AccordionPrimitive.Root;

export const GlassAccordionItem = AccordionPrimitive.Item;

export function GlassAccordionTrigger(
  props: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>,
) {
  const { className, children, ...rest } = props;

  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        {...rest}
        className={clsx('lg-button lg-accordion-trigger', className)}
      >
        <span>{children}</span>
        <svg
          viewBox="0 0 20 20"
          className="lg-accordion-chevron h-4 w-4 text-[var(--lg-muted-foreground)]"
          aria-hidden
        >
          <path
            d="M5 7.5l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function GlassAccordionContent(
  props: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>,
) {
  const { className, children, ...rest } = props;

  return (
    <AccordionPrimitive.Content {...rest} {...radixSlotProps}>
      <GlassPanel
        variant="card"
        elevation="base"
        refraction="soft"
        className={clsx('lg-accordion-content', className)}
      >
        {children}
      </GlassPanel>
    </AccordionPrimitive.Content>
  );
}
