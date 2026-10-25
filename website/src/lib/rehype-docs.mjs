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

const text = (node) =>
  node.type === 'text' ? node.value : (node.children ?? []).map(text).join('');

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });

const LANGUAGES = { tsx: 'TSX', ts: 'TypeScript', sh: 'Terminal', bash: 'Terminal', json: 'JSON', js: 'JavaScript', diff: 'Diff', xml: 'XML', md: 'Markdown' };

/** remark: records each code fence's title, in order, for the rehype pass. */
export function remarkCodeTitles() {
  return (tree, file) => {
    const titles = [];
    const walk = (node) => {
      if (node.type === 'code') titles.push(/title="([^"]+)"/.exec(node.meta ?? '')?.[1] ?? null);
      node.children?.forEach(walk);
    };
    walk(tree);
    file.data.codeTitles = titles;
  };
}

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

function codeBlock(pre, title) {
  const language = pre.properties?.dataLanguage ?? '';
  const code = pre.children.find((c) => c.tagName === 'code');
  const raw = text(code ?? pre).replace(/\n$/, '');
  const lines = raw.split('\n').length;
  const label = title ?? LANGUAGES[language] ?? language.toUpperCase();
  pre.properties.className = [...(pre.properties.className ?? []), ...(lines > 1 ? ['numbered'] : [])];
  return el('figure', { className: ['code-block'], dataLanguage: language }, [
    el('figcaption', { className: ['code-head'] }, [
      el('span', { className: [title ? 'code-file' : 'code-lang'] }, [{ type: 'text', value: label }]),
      el('button', { type: 'button', className: ['code-copy'], dataCopy: raw, ariaLabel: 'Copy code' }, [
        el('span', { className: ['copy-idle'] }, [{ type: 'text', value: 'Copy' }]),
        el('span', { className: ['copy-done'] }, [{ type: 'text', value: 'Copied' }]),
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
    const titles = file.data.codeTitles ?? [];
    let codeIndex = 0;
    const visit = (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== 'element') return node;
        if (node.tagName === 'blockquote') {
          const made = callout(node);
          if (made) return made;
        }
        if (node.tagName === 'pre') return codeBlock(node, titles[codeIndex++] ?? null);
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
