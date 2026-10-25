import { registerRootComponent } from 'expo';

import App from './App';
import Embed from './Embed';

// The project website loads this web build as a page-level Toaster (Embed.web.tsx).
const embedded = typeof window !== 'undefined' && Boolean(window.__EHT_EMBED__);

registerRootComponent(embedded ? Embed : App);
