import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../types';

/** Cookie holding the chosen language, so server and client render the same text. */
export const LANGUAGE_COOKIE = 'lang';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const isLanguage = (value: string | undefined | null): value is Language =>
  LANGUAGES.some((language) => language === value);

export const toLanguage = (value: string | undefined | null): Language =>
  isLanguage(value) ? value : DEFAULT_LANGUAGE;

/** Picks the first supported language from an Accept-Language header, honouring q-weights. */
const fromAcceptLanguage = (header: string): Language | undefined =>
  header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((param) => param.trim().startsWith('q='));
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        weight: q ? Number(q.split('=')[1]) : 1,
      };
    })
    .filter(({ weight }) => weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map(({ base }) => base)
    .find(isLanguage);

/** Cookie first, then the browser's Accept-Language, then the default. */
export const resolveLanguage = (
  cookieValue: string | undefined | null,
  acceptLanguage: string | undefined | null,
): Language => {
  if (isLanguage(cookieValue)) {
    return cookieValue;
  }
  return (acceptLanguage && fromAcceptLanguage(acceptLanguage)) || DEFAULT_LANGUAGE;
};

export const persistLanguage = (language: Language) => {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
};
