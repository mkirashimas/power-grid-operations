import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  {
    // Unused code is caught here rather than by tsc (noUnusedLocals), because tsc would also
    // check the files Next.js generates in .next/dev/types, which have unused imports.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'next-env.d.ts',
    'playwright-report/**',
    'test-results/**',
    'public/storybook/**',
  ]),
]);
