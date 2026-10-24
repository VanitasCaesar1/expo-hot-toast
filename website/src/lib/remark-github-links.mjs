const REPO = 'https://github.com/VanitasCaesar1/expo-hot-toast/blob/main/';

/** Rewrites repository-relative links (./docs/design.md) to their GitHub pages. */
export function relativeLinksToGitHub() {
  const walk = (node) => {
    if ((node.type === 'link' || node.type === 'definition') && typeof node.url === 'string') {
      if (node.url.startsWith('./') || (!/^[a-z]+:|^#|^\//i.test(node.url))) {
        node.url = REPO + node.url.replace(/^\.\//, '');
      }
    }
    if (node.children) node.children.forEach(walk);
  };
  return (tree) => walk(tree);
}
