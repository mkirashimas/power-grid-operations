import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      // About 2 points below the measured values (M11): CI fails if coverage drops.
      thresholds: { statements: 95, branches: 89, functions: 95, lines: 96 },
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/*.stories.tsx', '**/*.d.ts', 'src/test/**'],
    },
  },
});
