import type { MetadataRoute } from 'next';
import { getRequestLanguage, getServerTranslation } from '../i18n/server';
import { pageBackground } from '../pwa/colors';
import { PATHS } from '../types';

const ICONS: MetadataRoute.Manifest['icons'] = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const SHORTCUT_ICONS = [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }];

// Written by the demo tour (yarn demo:record); the sizes must match the files.
const SCREENSHOTS: MetadataRoute.Manifest['screenshots'] = [
  {
    src: '/screenshots/wide.png',
    sizes: '1440x900',
    type: 'image/png',
    form_factor: 'wide',
  },
  {
    src: '/screenshots/narrow.png',
    sizes: '390x844',
    type: 'image/png',
    form_factor: 'narrow',
  },
];

/**
 * The web app manifest, served at /manifest.webmanifest in the request's language. Browsers
 * fetch it without cookies, so the language comes from Accept-Language.
 */
const manifest = async (): Promise<MetadataRoute.Manifest> => {
  const [language, t] = await Promise.all([getRequestLanguage(), getServerTranslation()]);

  return {
    id: PATHS.HOME,
    name: t('appName'),
    short_name: t('appShortName'),
    description: t('appDescription'),
    lang: language,
    dir: 'ltr',
    start_url: PATHS.HOME,
    scope: PATHS.HOME,
    display: 'standalone',
    theme_color: pageBackground('light'),
    background_color: pageBackground('light'),
    categories: ['business', 'utilities'],
    icons: ICONS,
    screenshots: SCREENSHOTS,
    shortcuts: [
      { name: t('nav.alarms'), url: PATHS.ALARMS, icons: SHORTCUT_ICONS },
      { name: t('nav.map'), url: PATHS.MAP, icons: SHORTCUT_ICONS },
      { name: t('pwa.shortcutNewIncident'), url: PATHS.NEW_INCIDENT, icons: SHORTCUT_ICONS },
    ],
  };
};

export default manifest;
