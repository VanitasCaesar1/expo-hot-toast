/**
 * The docs' page components, made from plain Markdown so the same files still
 * read well on GitHub:
 *
 * - `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` blockquotes (GitHub's alerts)
 *   become callouts.
 * - Code blocks get a header (the fence's `title="App.tsx"`, or the language),
 *   a copy button and line numbers.
 * - Reference tables (an Option / Prop / Token / Parameter column) become
 *   property rows: the name, its type and default, and what it does.
 * - On step-by-step pages, each `##` section becomes a numbered step.
 */

import { siTypescript, siJavascript, siJson, siMarkdown } from 'simple-icons';

const text = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(text).join('');

/**
 * A node's classes as an array. Shiki writes them as a `class` string, other
 * steps as a `className` array; this reads either and leaves an array behind.
 */
function classes(node) {
  const props = (node.properties ??= {});
  if (!Array.isArray(props.className)) {
    const raw = props.className ?? props.class ?? '';
    props.className = String(raw).split(/\s+/).filter(Boolean);
    delete props.class;
  }
  return props.className;
}

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

export const LANGUAGES = { tsx: 'TSX', ts: 'TypeScript', sh: 'Terminal', bash: 'Terminal', json: 'JSON', js: 'JavaScript', diff: 'Diff', xml: 'XML', md: 'Markdown' };

/** `{1,3-5}` -> Set {1, 3, 4, 5}. */
function lineSet(meta) {
  const match = /\{([\d,\s-]+)\}/.exec(meta ?? '');
  const lines = new Set();
  for (const part of match?.[1].split(',') ?? []) {
    const [a, b] = part.trim().split('-').map(Number);
    for (let n = a; n <= (b || a); n++) lines.add(n);
  }
  return lines;
}

/**
 * remark: records each code fence's title (`title="App.tsx"`) and highlighted
 * lines (`{2,4-6}`), in order, for the rehype pass.
 */
export function remarkCodeTitles() {
  return (tree, file) => {
    const fences = [];
    const walk = (node) => {
      if (node.type === 'code') {
        fences.push({ title: /title="([^"]+)"/.exec(node.meta ?? '')?.[1] ?? null, highlight: lineSet(node.meta) });
      }
      node.children?.forEach(walk);
    };
    walk(tree);
    file.data.codeFences = fences;
  };
}

const brand = (icon) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#${icon.hex}" d="${icon.path}"/></svg>`;
const glyph = (d) => `<svg viewBox="0 0 256 256" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
// Phosphor's terminal-window and git-diff, for the blocks without a brand.
const TERMINAL = glyph('M128 128a8 8 0 0 1-3 6.25l-40 32a8 8 0 1 1-10-12.5L107.19 128 75 102.25a8 8 0 1 1 10-12.5l40 32a8 8 0 0 1 3 6.25Zm48 24h-40a8 8 0 0 0 0 16h40a8 8 0 0 0 0-16Zm56-96v144a16 16 0 0 1-16 16H40a16 16 0 0 1-16-16V56a16 16 0 0 1 16-16h176a16 16 0 0 1 16 16Zm-16 144V56H40v144h176Z');
const DIFF = glyph('M112 152a8 8 0 0 0-8 8v28.69L75.72 160.4A39.71 39.71 0 0 1 64 132.12V95a32 32 0 1 0-16 0v37.13a55.67 55.67 0 0 0 16.4 39.6L92.69 200H64a8 8 0 0 0 0 16h48a8 8 0 0 0 8-8v-48a8 8 0 0 0-8-8ZM40 64a16 16 0 1 1 16 16 16 16 0 0 1-16-16Zm168 97V123.88a55.67 55.67 0 0 0-16.4-39.6L163.31 56H192a8 8 0 0 0 0-16h-48a8 8 0 0 0-8 8v48a8 8 0 0 0 16 0V67.31l28.28 28.29A39.71 39.71 0 0 1 192 123.88V161a32 32 0 1 0 16 0Zm-8 47a16 16 0 1 1 16-16 16 16 0 0 1-16 16Z');
export const ICONS = {
  ts: brand(siTypescript),
  tsx: brand(siTypescript),
  js: brand(siJavascript),
  jsx: brand(siJavascript),
  json: brand(siJson),
  md: brand(siMarkdown),
  sh: TERMINAL,
  bash: TERMINAL,
  diff: DIFF,
};

const ALERTS = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

function callout(node) {
  const first = node.children.find((c) => c.type === 'element');
  if (!first || first.tagName !== 'p') return null;
  const lead = first.children[0];
  const match = lead?.type === 'text' ? /^\s*\[!(\w+)\]\s*/.exec(lead.value) : null;
  if (!match || !ALERTS[match[1]]) return null;
  lead.value = lead.value.slice(match[0].length);
  if (!lead.value && first.children[1]?.tagName === 'br') first.children.splice(1, 1);
  const kind = match[1].toLowerCase();
  return el('div', { className: ['callout', `callout-${kind}`], role: 'note' }, [
    el('p', { className: ['callout-title'] }, [{ type: 'text', value: ALERTS[match[1]] }]),
    ...node.children,
  ]);
}

export const COPY = glyph('M216 32H88a8 8 0 0 0-8 8v40H40a8 8 0 0 0-8 8v128a8 8 0 0 0 8 8h128a8 8 0 0 0 8-8v-40h40a8 8 0 0 0 8-8V40a8 8 0 0 0-8-8Zm-56 176H48V96h112Zm48-48h-32V88a8 8 0 0 0-8-8H96V48h112Z');
export const CHECK = glyph('m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z');

function codeBlock(pre, fence) {
  const language = pre.properties?.dataLanguage ?? '';
  const code = pre.children.find((c) => c.tagName === 'code');
  const raw = text(code ?? pre).replace(/\n$/, '');
  const count = raw.split('\n').length;
  const title = fence?.title ?? null;
  const label = title ?? LANGUAGES[language] ?? language.toUpperCase();
  if (count > 1 && language !== 'sh') classes(pre).push('numbered');
  // Line classes: highlighted lines from the fence, and a diff's + and - lines.
  let n = 0;
  for (const line of code?.children ?? []) {
    if (line.type !== 'element' || !classes(line).includes('line')) continue;
    n += 1;
    const list = classes(line);
    if (fence?.highlight?.has(n)) list.push('hl');
    if (language === 'diff') {
      const first = text(line)[0];
      if (first === '+') list.push('add');
      if (first === '-') list.push('del');
    }
  }
  const icon = ICONS[language];
  return el('figure', { className: ['code-block'], dataLanguage: language }, [
    el('figcaption', { className: ['code-head'] }, [
      el('span', { className: ['code-title'] }, [
        ...(icon ? [el('span', { className: ['code-icon'] }, [{ type: 'raw', value: icon }])] : []),
        el('span', { className: [title ? 'code-file' : 'code-lang'] }, [{ type: 'text', value: label }]),
      ]),
      el('button', { type: 'button', className: ['code-copy'], dataCopy: raw, ariaLabel: 'Copy code' }, [
        el('span', { className: ['copy-idle'] }, [{ type: 'raw', value: COPY }, { type: 'text', value: 'Copy' }]),
        el('span', { className: ['copy-done'] }, [{ type: 'raw', value: CHECK }, { type: 'text', value: 'Copied' }]),
      ]),
    ]),
    pre,
  ]);
}

const NAME_COLUMNS = new Set(['option', 'prop', 'token', 'parameter', 'property']);

function cells(row) {
  return row.children.filter((c) => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'));
}

function propertyRows(table) {
  const thead = table.children.find((c) => c.tagName === 'thead');
  const tbody = table.children.find((c) => c.tagName === 'tbody');
  if (!thead || !tbody) return null;
  const headRow = thead.children.find((c) => c.tagName === 'tr');
  const headers = cells(headRow).map((c) => text(c).trim());
  if (!NAME_COLUMNS.has(headers[0]?.toLowerCase())) return null;
  // The description is the last column when it has no heading, or says so.
  const last = headers.length - 1;
  const described = headers[last] === '' || /^description$/i.test(headers[last]);
  const rows = tbody.children.filter((c) => c.tagName === 'tr');
  return el(
    'div',
    { className: ['props'] },
    rows.map((row) => {
      const values = cells(row);
      const name = values[0];
      const nameText = text(name).trim().replace(/[`()]/g, '');
      const meta = [];
      for (let i = 1; i < values.length; i++) {
        if (described && i === last) continue;
        const header = headers[i];
        const children = values[i].children;
        if (/^type$/i.test(header)) meta.push(el('span', { className: ['prop-type'] }, children));
        else meta.push(el('span', { className: ['prop-meta'] }, [el('span', { className: ['prop-label'] }, [{ type: 'text', value: `${header}: ` }]), ...children]));
      }
      return el('div', { className: ['prop'], id: `prop-${nameText.replace(/[^\w-]+/g, '-')}` }, [
        el('div', { className: ['prop-head'] }, [el('span', { className: ['prop-name'] }, name.children), ...meta]),
        ...(described ? [el('div', { className: ['prop-desc'] }, values[last].children)] : []),
      ]);
    }),
  );
}

/** rehype: callouts, code blocks and property rows. */
export function rehypeDocs() {
  return (tree, file) => {
    const fences = file.data.codeFences ?? [];
    let codeIndex = 0;
    const visit = (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== 'element') return node;
        if (node.tagName === 'blockquote') {
          const made = callout(node);
          if (made) return made;
        }
        if (node.tagName === 'pre') return codeBlock(node, fences[codeIndex++]);
        if (node.tagName === 'table') {
          const made = propertyRows(node);
          if (made) return made;
          // Other tables scroll inside a frame of their own.
          return el('div', { className: ['table-frame'] }, [node]);
        }
        visit(node);
        return node;
      });
    };
    visit(tree);
  };
}

/** A `##` with one of these names closes the steps instead of being one. */
export const STEPS_END = /^(where next|next|next steps|see also|requirements)$/i;

/** rehype, for step-by-step pages: each `##` and what follows it is a step. */
export function rehypeSteps() {
  return (tree) => {
    const lead = [];
    const steps = [];
    const after = [];
    let step = null;
    let done = false;
    for (const node of tree.children) {
      const heading = node.type === 'element' && node.tagName === 'h2';
      // A closing "Where next" section follows the steps instead of being one.
      if (heading && STEPS_END.test(text(node).trim())) done = true;
      if (done) after.push(node);
      else if (heading) {
        step = el('section', { className: ['step'] }, [node]);
        steps.push(step);
      } else if (step) step.children.push(node);
      else lead.push(node);
    }
    tree.children = [...lead, el('div', { className: ['steps'] }, steps), ...after];
  };
}
