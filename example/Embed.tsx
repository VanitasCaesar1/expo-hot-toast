/**
 * The page-level Toaster for the project website exists only on the web
 * (Embed.web.tsx). Native builds never mount it; this keeps react-dom out of
 * their bundles.
 */
export default function Embed() {
  return null;
}
