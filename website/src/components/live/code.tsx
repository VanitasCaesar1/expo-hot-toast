import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * A small highlighter for the snippets the live demos write as you change
 * them. They are a few lines of toast calls and Toaster props, so a handful of
 * token rules covers them, in the github-dark-dimmed colours the static code
 * panels use.
 */
const RULES: Array<[RegExp, string]> = [
  [/^\/\/[^\n]*/, 'comment'],
  [/^'(?:[^'\\]|\\.)*'|^"(?:[^"\\]|\\.)*"|^`(?:[^`\\]|\\.)*`/, 'string'],
  [/^<\/?[A-Z][A-Za-z]*/, 'tag'],
  [/^\b(?:await|const|true|false|new|return|async|undefined)\b/, 'keyword'],
  [/^\b\d+(?:\.\d+)?\b/, 'number'],
  [/^[A-Za-z_$][\w$]*(?==)/, 'prop'],
  [/^[A-Za-z_$][\w$]*(?=\s*\()/, 'call'],
  [/^[A-Za-z_$][\w$]*(?=:)/, 'key'],
  [/^[A-Za-z_$][\w$]*/, 'plain'],
  [/^\s+/, 'plain'],
  [/^./, 'punct'],
];

function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = code;
  let key = 0;
  while (rest.length > 0) {
    for (const [pattern, kind] of RULES) {
      const match = rest.match(pattern);
      if (!match) continue;
      const text = match[0];
      out.push(
        kind === 'plain' ? (
          text
        ) : (
          <span key={key++} className={`tok-${kind}`}>
            {text}
          </span>
        ),
      );
      rest = rest.slice(text.length);
      break;
    }
  }
  return out;
}

export function LiveCode({ code, file }: { code: string; file: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable; the code stays selectable.
    }
  };
  return (
    <div className="live-code">
      <div className="live-code-bar">
        <span className="label">{file}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${file}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code>{highlight(code)}</code>
      </pre>
    </div>
  );
}
