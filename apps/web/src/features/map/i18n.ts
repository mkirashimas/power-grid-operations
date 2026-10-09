import { registerNamespace } from '../../i18n';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ro from './locales/ro.json';

export const MAP_NAMESPACE = 'map';

registerNamespace(MAP_NAMESPACE, { en, es, fr, it, ro });
