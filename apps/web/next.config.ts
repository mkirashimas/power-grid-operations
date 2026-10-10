import path from 'node:path';
import type { NextConfig } from 'next';

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
};

export default nextConfig;
