import { describe, expect, it, vi } from 'vitest';
import manifest from './manifest';

const request = vi.hoisted(() => ({ acceptLanguage: 'en' }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ 'accept-language': request.acceptLanguage }),
}));

describe('manifest', () => {
  it('describes the installable app in the request language', async () => {
    request.acceptLanguage = 'it-IT,it;q=0.9';
    const result = await manifest();
    expect(result).toMatchObject({
      name: 'Power Grid Operations',
      short_name: 'Grid Ops',
      lang: 'it',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
    expect(result.shortcuts?.map(({ name, url }) => [name, url])).toEqual([
      ['Allarmi', '/alarms'],
      ['Mappa', '/map'],
      ['Nuovo incidente', '/incidents/new'],
    ]);
  });

  it('has regular and maskable icons at both required sizes', async () => {
    request.acceptLanguage = 'en';
    const icons = (await manifest()).icons ?? [];
    expect(icons.map(({ sizes, purpose }) => `${sizes} ${purpose}`)).toEqual([
      '192x192 any',
      '512x512 any',
      '192x192 maskable',
      '512x512 maskable',
    ]);
  });
});
