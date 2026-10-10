// Which runtime cache a request belongs to. Pure, so the service worker's routing is tested in
// Node; src/pwa/sw.ts maps each kind to a Serwist strategy.

/**
 * - `static`: hashed Next.js build output (`/_next/static`), never changes: cache first.
 * - `page`: a full page load: network first, the cached copy when offline.
 * - `rsc`: a client-side navigation (React Server Components payload): network first.
 * - `assets`: the asset list (`/api/assets`), changes rarely: stale-while-revalidate.
 * - `eia`: EIA demand and forecasts (`/api/eia/*`): network first, the last copy when offline.
 * - `file`: icons, screenshots and the sample PDFs in `public`: stale-while-revalidate.
 *
 * `null` means the service worker leaves the request alone: other origins (map tiles, the
 * realtime WebSocket), Storybook, the service worker script and anything else.
 */
export type CacheKind = 'static' | 'page' | 'rsc' | 'assets' | 'eia' | 'file';

export interface CacheRequest {
  url: URL;
  sameOrigin: boolean;
  /** `request.mode`: 'navigate' for a full page load. */
  mode: RequestMode;
  /** `request.headers.get('RSC')`: '1' for a React Server Components fetch. */
  rscHeader: string | null;
}

// Served as static files, or by Next.js but outside the app's pages.
const BYPASS_PREFIXES = ['/storybook', '/serwist/', '/manifest.webmanifest'];
const FILE_PREFIXES = ['/icons/', '/screenshots/', '/samples/'];

const startsWithAny = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => pathname.startsWith(prefix));

export const classifyRequest = ({
  url,
  sameOrigin,
  mode,
  rscHeader,
}: CacheRequest): CacheKind | null => {
  if (!sameOrigin) return null;
  const { pathname } = url;
  if (startsWithAny(pathname, BYPASS_PREFIXES)) return null;
  if (pathname.startsWith('/_next/static/')) return 'static';
  if (pathname === '/api/assets') return 'assets';
  if (pathname.startsWith('/api/eia/')) return 'eia';
  if (pathname.startsWith('/api/')) return null;
  if (startsWithAny(pathname, FILE_PREFIXES)) return 'file';
  if (rscHeader === '1') return 'rsc';
  if (mode === 'navigate') return 'page';
  return null;
};
