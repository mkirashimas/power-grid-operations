import { createInstance, type i18n as I18n } from 'i18next';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../types';
import en from './locales/en/common.json';
import es from './locales/es/common.json';
import fr from './locales/fr/common.json';
import it from './locales/it/common.json';
import ro from './locales/ro/common.json';

export const COMMON_NAMESPACE = 'common';

export type NamespaceResources = Record<Language, Record<string, unknown>>;

// Every namespace registered so far. Features register theirs from their own i18n.ts,
// which runs as soon as any of the feature's modules is imported.
const bundles = new Map<string, NamespaceResources>([[COMMON_NAMESPACE, { en, es, fr, it, ro }]]);

// The single instance used in the browser. On the server each request gets its own
// instance instead, so concurrent requests in different languages never interfere.
let browserInstance: I18n | undefined;

// Server instances that may still be rendering. A feature's module (and so its namespace) can
// load after the request's instance was created, e.g. on the first request after the server
// starts: such a late namespace is added to these too, or the server would render raw keys.
// Weak references, so finished requests are garbage-collected.
const serverInstances = new Set<WeakRef<I18n>>();
const trackServerInstance = (instance: I18n) => {
  serverInstances.add(new WeakRef(instance));
  if (serverInstances.size > 256) {
    serverInstances.forEach((ref) => {
      if (!ref.deref()) serverInstances.delete(ref);
    });
  }
};

const toResources = () =>
  Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      Object.fromEntries(
        [...bundles].map(([namespace, resources]) => [namespace, resources[language]]),
      ),
    ]),
  );

/** Registers a feature's translation namespace for all supported languages. */
export const registerNamespace = (namespace: string, resources: NamespaceResources) => {
  bundles.set(namespace, resources);
  const instances = [browserInstance, ...[...serverInstances].map((ref) => ref.deref())];
  instances.forEach((instance) =>
    LANGUAGES.forEach((language) =>
      instance?.addResourceBundle(language, namespace, resources[language], true, true),
    ),
  );
};

/** Creates a fully initialised instance; resources are bundled, so init is synchronous. */
export const createI18n = (language: Language): I18n => {
  const instance = createInstance();
  // No initReactI18next: client components get the instance from I18nextProvider, and this
  // module must stay free of react-i18next so server components can import it.
  void instance.init({
    resources: toResources(),
    lng: language,
    supportedLngs: LANGUAGES,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: [...bundles.keys()],
    defaultNS: COMMON_NAMESPACE,
    interpolation: { escapeValue: false },
    initAsync: false,
    react: { useSuspense: false },
  });
  return instance;
};

/** One instance per request on the server, one shared instance in the browser. */
export const getI18n = (language: Language): I18n => {
  if (typeof window === 'undefined') {
    const instance = createI18n(language);
    trackServerInstance(instance);
    return instance;
  }
  browserInstance ??= createI18n(language);
  return browserInstance;
};
