import { useEffect, useRef, useState } from 'react';
import { AI_CHATS, logoSvg } from '../../lib/ai-brands';

const SITE = 'https://vanitascaesar1.github.io/expo-hot-toast';

const SUGGESTIONS = [
  'How do I show a toast above a modal?',
  'How do I theme toasts for dark mode?',
  'What is different from react-hot-toast?',
  'How do I turn haptics off?',
];

const PICKED = ['chatgpt', 'claude', 't3', 'perplexity'];

/**
 * Ask AI, the top bar's button and its popover. It opens the chat you pick
 * with your question and the full docs (llms-full.txt) attached, so the answer
 * comes from the docs rather than from memory; the site has no AI of its own.
 * With no question typed, the chat opens ready for one.
 */
export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const prompt = () => {
    const q = question.trim();
    return q
      ? `Using the expo-hot-toast docs at ${SITE}/llms-full.txt, answer this question about expo-hot-toast: ${q}`
      : `I am using expo-hot-toast. Read its docs at ${SITE}/llms-full.txt so you can answer my questions about it.`;
  };
  const chats = AI_CHATS.filter((c) => PICKED.includes(c.id));

  return (
    <div className="ask" ref={root}>
      <button type="button" className="ask-button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 256 256" aria-hidden="true" className="ask-spark">
          <path
            fill="currentColor"
            d="M197.58 129.06 146 110l-19-51.62a15.92 15.92 0 0 0-29.88 0L78 110l-51.62 19a15.92 15.92 0 0 0 0 29.88L78 178l19 51.62a15.92 15.92 0 0 0 29.88 0L146 178l51.62-19a15.92 15.92 0 0 0 0-29.88ZM137 164.22a8 8 0 0 0-4.74 4.74L112 223.85 91.78 169a8 8 0 0 0-4.74-4.74L32.15 144 87 123.78a8 8 0 0 0 4.78-4.78L112 64.15 132.22 119a8 8 0 0 0 4.74 4.74L191.85 144Z"
          />
        </svg>
        <span>Ask AI</span>
      </button>
      {open && (
        <div className="ask-panel" role="dialog" aria-label="Ask AI about expo-hot-toast">
          <p className="ask-title">Ask AI about expo-hot-toast</p>
          <p className="ask-note">Opens your chat with the full docs attached, so the answer comes from them.</p>
          <textarea
            ref={field}
            rows={3}
            value={question}
            placeholder="Ask a question…"
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                window.open(chats[0]!.url(prompt()), '_blank', 'noopener');
              }
            }}
          />
          <div className="ask-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setQuestion(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="ask-send">
            {chats.map((chat) => (
              <a key={chat.id} href={chat.url(prompt())} target="_blank" rel="noopener" className={chat.id === 'chatgpt' ? 'primary' : undefined}>
                <span className="ai-logo" dangerouslySetInnerHTML={{ __html: logoSvg(chat.logo) }} />
                {chat.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
