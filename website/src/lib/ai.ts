/**
 * Plain-text versions of the docs for AI tools: /llms.txt (an index, per
 * llmstxt.org), /llms-full.txt (every page in one file) and a Markdown file per
 * page. They are built from the same docs/guide files as the site.
 */
import { GROUPS, loadDocs } from './docs';
import { INSTALL, REPO_URL } from './url';

export const SITE = 'https://vanitascaesar1.github.io/expo-hot-toast';

/** A page as Markdown, with links between pages made absolute. */
export function pageMarkdown(slug: string): string {
  const page = loadDocs().find((p) => p.slug === slug);
  if (!page) throw new Error(`No docs page ${slug}`);
  const body = page.markdown.replace(/\]\(\.\/([a-z0-9-]+)\.md(#[a-z0-9-]+)?\)/g, `](${SITE}/docs/md/$1.md$2)`);
  return `# ${page.title}\n\n> ${page.description}\n\n${body}\n`;
}

export function llmsIndex(): string {
  const pages = loadDocs();
  const sections = GROUPS.map((g) => {
    const items = pages
      .filter((p) => p.group === g)
      .map((p) => `- [${p.title}](${SITE}/docs/md/${p.slug}.md): ${p.description}`)
      .join('\n');
    return `## ${g}\n\n${items}`;
  }).join('\n\n');
  return `# expo-hot-toast

> Toasts for Expo and React Native with the react-hot-toast API: toast(), toast.success(), toast.promise(), <Toaster>. Drawn in Liquid Glass on iOS 26 (expo-glass-effect) and on an opaque surface elsewhere. Install: \`${INSTALL}\`, then the peer dependencies listed in Installation.

All pages in one file: ${SITE}/llms-full.txt
Source: ${REPO_URL}

${sections}
`;
}

export function llmsFull(): string {
  return loadDocs()
    .map((p) => pageMarkdown(p.slug))
    .join('\n---\n\n');
}

/** For an AI coding agent working in the reader's app. */
export const SETUP_PROMPT = `Add expo-hot-toast to this Expo / React Native app.

1. Read ${SITE}/llms-full.txt for the full API.
2. Install it: ${INSTALL}
3. Install the peer dependencies with npx expo install: expo-glass-effect expo-haptics react-native-reanimated react-native-worklets react-native-gesture-handler react-native-safe-area-context react-native-svg
4. Make sure the app root is wrapped in GestureHandlerRootView and SafeAreaProvider (Expo Router already provides SafeAreaProvider), and render <Toaster /> once, after the rest of the app.
5. Replace the app's existing toasts, alerts used as notifications, or snackbars with toast(), toast.success(), toast.error() and toast.promise(). Use action: { label: 'Undo', onPress } where an Undo makes sense.
6. Do not add a Babel plugin if the project uses babel-preset-expo; it adds the Worklets plugin itself.

Show me the diff before changing behaviour beyond swapping toasts.`;
