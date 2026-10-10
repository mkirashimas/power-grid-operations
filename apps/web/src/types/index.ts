export * from './paths';

/** Supported languages, alphabetically ordered. */
export const LANGUAGES = ['en', 'es', 'fr', 'it', 'ro'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';
