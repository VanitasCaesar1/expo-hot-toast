import '../glassyui/styles/liquid.css';
import './site-glass.css';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '../glassyui/glass-accordion';

/** The questions, as a Glassy UI accordion. */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <GlassAccordion type="multiple" className="faq-list">
      {items.map((item) => (
        <GlassAccordionItem key={item.q} value={item.q} className="faq-item">
          <GlassAccordionTrigger>{item.q}</GlassAccordionTrigger>
          <GlassAccordionContent>
            <p>{item.a}</p>
          </GlassAccordionContent>
        </GlassAccordionItem>
      ))}
    </GlassAccordion>
  );
}
