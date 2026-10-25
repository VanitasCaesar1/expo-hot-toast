import * as Accordion from '@radix-ui/react-accordion';
import '../glassyui/styles/liquid.css';
import './site-glass.css';
import { GlassPanel } from '../glassyui/glass-panel';

/**
 * The questions: one Glassy UI panel, a row per question, opening in place.
 * Radix's accordion underneath, as Glassy's own accordion uses; its separate
 * pill per question spread six short questions over a whole screen.
 */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <GlassPanel variant="card" className="faq-card">
      <Accordion.Root type="multiple" className="faq-list">
        {items.map((item) => (
          <Accordion.Item key={item.q} value={item.q} className="faq-item">
            <Accordion.Header className="faq-heading">
              <Accordion.Trigger className="faq-trigger">
                <span>{item.q}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true" className="faq-chevron">
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="faq-answer">
              <p>{item.a}</p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </GlassPanel>
  );
}
