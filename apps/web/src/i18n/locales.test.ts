import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../types';

// Every locale file in the app: src/i18n/locales/<lang>/common.json and
// src/features/<feature>/locales/<lang>.json.
const files = import.meta.glob<Record<string, unknown>>(
  ['../i18n/locales/*/*.json', '../features/*/locales/*.json'],
  { eager: true, import: 'default' },
);

const keyPaths = (value: unknown, prefix = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, child]) =>
        keyPaths(child, prefix ? `${prefix}.${key}` : key),
      )
    : [prefix];

const toNamespaceAndLanguage = (path: string): [string, string] => {
  const feature = path.match(/features\/(\w+)\/locales\/(\w+)\.json$/);
  if (feature) {
    return [`features/${feature[1]}`, feature[2]];
  }
  // Vite normalises same-folder globs to './locales/<lang>/<namespace>.json'.
  const common = path.match(/locales\/(\w+)\/(\w+)\.json$/);
  if (common) {
    return [common[2], common[1]];
  }
  throw new Error(`Unexpected locale file: ${path}`);
};

/** Locale contents grouped by namespace ('common', 'features/home', ...) and language. */
const namespaces: Record<string, Record<string, unknown>> = {};
Object.entries(files).forEach(([path, content]) => {
  const [namespace, language] = toNamespaceAndLanguage(path);
  namespaces[namespace] = { ...namespaces[namespace], [language]: content };
});

describe('locale files', () => {
  it('finds the common and home namespaces', () => {
    expect(Object.keys(namespaces)).toEqual(expect.arrayContaining(['common', 'features/home']));
  });

  it.each(Object.entries(namespaces))('%s has every key in all languages', (_, byLanguage) => {
    expect(Object.keys(byLanguage).sort()).toEqual([...LANGUAGES]);
    const reference = keyPaths(byLanguage.en).sort();
    LANGUAGES.forEach((language) => {
      expect(keyPaths(byLanguage[language]).sort(), language).toEqual(reference);
    });
  });
});
