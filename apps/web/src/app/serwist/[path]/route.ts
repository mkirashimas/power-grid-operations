import { createSerwistRoute } from '@serwist/turbopack';
import { randomUUID } from 'node:crypto';
import { PATHS } from '../../../types';

// Serves the service worker at PATHS.SERVICE_WORKER. It is bundled once, at build time (the
// route is static), with every file in .next/static and public in its precache list.

// The offline page is server-rendered, so it has no content hash: a new revision per build
// makes each deploy precache a fresh copy.
const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'src/pwa/sw.ts',
    // Native esbuild on every platform (the default, esbuild-wasm, is not installed).
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: PATHS.OFFLINE, revision }],
    // Storybook is a separate site with its own assets; it is not part of the app.
    globIgnores: ['**/node_modules/**/*', 'public/storybook/**/*', 'public/.gitkeep'],
  },
);
