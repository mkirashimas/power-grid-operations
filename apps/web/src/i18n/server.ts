import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { createI18n } from './index';
import { LANGUAGE_COOKIE, resolveLanguage } from './language';

/** The request's language: cookie, then Accept-Language, then the default. */
export const getRequestLanguage = cache(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLanguage(
    cookieStore.get(LANGUAGE_COOKIE)?.value,
    headerList.get('accept-language'),
  );
});

const getRequestI18n = cache(async () => createI18n(await getRequestLanguage()));

/** `t` for server components, e.g. `const t = await getServerTranslation(HOME_NAMESPACE)`. */
export const getServerTranslation = async (namespace?: string) =>
  (await getRequestI18n()).getFixedT(null, namespace ?? null);
