import { describe, expect, it } from 'vitest';
import { classifyRequest, type CacheRequest } from './caching';

const request = (path: string, overrides: Partial<CacheRequest> = {}): CacheRequest => ({
  url: new URL(path, 'https://grid.example'),
  sameOrigin: true,
  mode: 'cors',
  rscHeader: null,
  ...overrides,
});

describe('classifyRequest', () => {
  it.each<[string, Partial<CacheRequest>, string]>([
    ['/_next/static/chunks/app.js', {}, 'static'],
    ['/_next/static/media/roboto.woff2', {}, 'static'],
    ['/api/assets', {}, 'assets'],
    ['/api/eia/ercot?days=7', {}, 'eia'],
    ['/icons/icon-192.png', {}, 'file'],
    ['/samples/incidents/switching-order.pdf', {}, 'file'],
    ['/alarms', { mode: 'navigate' }, 'page'],
    ['/alarms', { rscHeader: '1' }, 'rsc'],
  ])('%s → %s', (path, overrides, kind) => {
    expect(classifyRequest(request(path, overrides))).toBe(kind);
  });

  it.each([
    ['another origin (map tiles)', request('/tiles/1/2/3.pbf', { sameOrigin: false })],
    ['Storybook', request('/storybook/index.html', { mode: 'navigate' })],
    ['the service worker itself', request('/serwist/sw.js')],
    ['the manifest', request('/manifest.webmanifest')],
    ['other API routes', request('/api/other')],
    ['an RSC fetch to an API route', request('/api/assets/x', { rscHeader: '1' })],
    ['a plain fetch of a page URL', request('/alarms')],
  ])('leaves %s alone', (_, value) => {
    expect(classifyRequest(value)).toBeNull();
  });
});
