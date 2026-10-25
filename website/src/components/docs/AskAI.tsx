import { useEffect, useRef, useState } from 'react';

const SITE = 'https://vanitascaesar1.github.io/expo-hot-toast';

const SUGGESTIONS = [
  'How do I show a toast above a modal?',
  'How do I theme toasts for dark mode?',
  'What is different from react-hot-toast?',
  'How do I turn haptics off?',
];

const CHATS = [
  { name: 'ChatGPT', href: (q: string) => `https://chatgpt.com/?hints=search&q=${q}` },
  { name: 'Claude', href: (q: string) => `https://claude.ai/new?q=${q}` },
  { name: 'T3 Chat', href: (q: string) => `https://t3.chat/new?q=${q}` },
];

/**
 * Ask AI, after Clerk's assistant: a question box that opens your chat of
 * choice with the full docs (llms-full.txt) attached, so the answer comes from
 * the docs rather than from memory. The site has no AI of its own.
 */
export default function AskAI() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('docs:ask', show);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('docs:ask', show);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const prompt = (q: string) =>
    encodeURIComponent(`Using the expo-hot-toast docs at ${SITE}/llms-full.txt, answer this question about expo-hot-toast: ${q}`);

  return (
    <>
      <button type="button" className="ask-fab" aria-label="Ask AI about expo-hot-toast" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 256 256" aria-hidden="true">
          <path
            fill="currentColor"
            d="M197.58 129.06 146 110l-19-51.62a15.92 15.92 0 0 0-29.88 0L78 110l-51.62 19a15.92 15.92 0 0 0 0 29.88L78 178l19 51.62a15.92 15.92 0 0 0 29.88 0L146 178l51.62-19a15.92 15.92 0 0 0 0-29.88ZM137 164.22a8 8 0 0 0-4.74 4.74L112 223.85 91.78 169a8 8 0 0 0-4.74-4.74L32.15 144 87 123.78a8 8 0 0 0 4.78-4.78L112 64.15 132.22 119a8 8 0 0 0 4.74 4.74L191.85 144ZM144 40a8 8 0 0 1 8-8h16V16a8 8 0 0 1 16 0v16h16a8 8 0 0 1 0 16h-16v16a8 8 0 0 1-16 0V48h-16a8 8 0 0 1-8-8Zm104 48a8 8 0 0 1-8 8h-8v8a8 8 0 0 1-16 0v-8h-8a8 8 0 0 1 0-16h8v-8a8 8 0 0 1 16 0v8h8a8 8 0 0 1 8 8Z"
          />
        </svg>
      </button>
      {open && (
        <div className="ask-panel" role="dialog" aria-label="Ask AI">
          <div className="ask-head">
            <p>Ask AI</p>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (question.trim()) window.open(CHATS[0].href(prompt(question.trim())), '_blank', 'noopener');
            }}
          >
            <textarea
              ref={field}
              rows={3}
              value={question}
              placeholder="Ask anything about expo-hot-toast…"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
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
              {CHATS.map((chat) => (
                <a
                  key={chat.name}
                  className={chat.name === 'ChatGPT' ? 'primary' : undefined}
                  href={question.trim() ? chat.href(prompt(question.trim())) : undefined}
                  aria-disabled={!question.trim()}
                  target="_blank"
                  rel="noopener"
                >
                  Ask {chat.name}
                </a>
              ))}
            </div>
            <p className="ask-note">Opens your chat with the full docs attached, so answers come from them.</p>
          </form>
        </div>
      )}
    </>
  );
}
