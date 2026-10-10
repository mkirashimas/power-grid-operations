/// <reference lib="webworker" />
// The service worker. Bundled by Serwist (src/app/serwist/[path]/route.ts) at build time,
// with the precache manifest injected as `self.__SW_MANIFEST`.
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from 'serwist';
import { PATHS } from '../types/paths';
import { classifyRequest, type CacheKind } from './caching';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY_SECONDS = 24 * 60 * 60;

const expiration = (maxEntries: number, maxAgeDays: number) =>
  new ExpirationPlugin({ maxEntries, maxAgeSeconds: maxAgeDays * DAY_SECONDS });

const HANDLERS: Record<CacheKind, RuntimeCaching['handler']> = {
  static: new CacheFirst({ cacheName: 'next-static', plugins: [expiration(400, 60)] }),
  page: new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 10,
    plugins: [expiration(50, 7)],
  }),
  rsc: new NetworkFirst({
    cacheName: 'pages-rsc',
    networkTimeoutSeconds: 10,
    plugins: [expiration(100, 7)],
  }),
  assets: new StaleWhileRevalidate({ cacheName: 'api-assets', plugins: [expiration(4, 30)] }),
  eia: new NetworkFirst({
    cacheName: 'api-eia',
    networkTimeoutSeconds: 5,
    plugins: [expiration(20, 7)],
  }),
  file: new StaleWhileRevalidate({ cacheName: 'files', plugins: [expiration(50, 30)] }),
};

const runtimeCaching: RuntimeCaching[] = (Object.keys(HANDLERS) as CacheKind[]).map((kind) => ({
  matcher: ({ url, request, sameOrigin }) =>
    classifyRequest({
      url,
      sameOrigin,
      mode: request.mode,
      rscHeader: request.headers.get('RSC'),
    }) === kind,
  handler: HANDLERS[kind],
}));

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version waits until the user clicks "Reload" (SKIP_WAITING from useServiceWorker),
  // so a deploy never reloads a page in the middle of an edit.
  skipWaiting: false,
  // The first install takes over the open page at once, so it works offline right away.
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: PATHS.OFFLINE, matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();
