import { withSerwist } from '@serwist/turbopack';
import path from 'node:path';
import type { NextConfig } from 'next';
import { PATHS } from './src/types/paths';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run container (see Dockerfile).
  output: 'standalone',
  // Trace files from the monorepo root so workspace packages end up in the bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; Next.js compiles them.
  transpilePackages: ['@pgo/downsample', '@pgo/grid-model', '@pgo/ui'],
  // The design system's Storybook is built into public/storybook (yarn build:storybook).
  redirects: async () => [
    { source: '/storybook', destination: '/storybook/index.html', permanent: false },
  ],
  // Browsers must always revalidate the service worker script, or updates arrive late.
  headers: async () => [
    {
      source: PATHS.SERVICE_WORKER,
      headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
    },
  ],
};

// Keeps esbuild (which bundles the service worker) out of the server bundle.
export default withSerwist(nextConfig);
