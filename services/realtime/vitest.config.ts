import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      // About 2 points below the measured values (M11): CI fails if coverage drops.
      thresholds: { statements: 85, branches: 71, functions: 83, lines: 88 },
      include: ['src/**/*.ts'],
      // main.ts only reads env and starts the server; e2e starts it on every run.
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.stories.tsx',
        '**/*.d.ts',
        'src/test/**',
        'src/main.ts',
      ],
    },
  },
});
