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
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      // About 2 points below the measured values (M12): CI fails if coverage drops.
      thresholds: { statements: 51, branches: 40, functions: 48, lines: 51 },
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.stories.tsx', '**/*.d.ts', 'src/test/**'],
    },
  },
});
