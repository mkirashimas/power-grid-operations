import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // 'server-only' throws outside React Server Components; tests import server modules directly.
    alias: { 'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
