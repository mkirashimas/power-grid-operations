import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { routeTiles } from './support/pages';

// The other specs block the service worker (playwright.config.ts); these turn it on.
test.use({ locale: 'en-US', serviceWorkers: 'allow' });

interface ManifestImage {
  src: string;
  sizes: string;
}

/** Width × height from a PNG's IHDR chunk. */
const pngSize = (bytes: Buffer) => `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;

const expectPng = async (request: APIRequestContext, { src, sizes }: ManifestImage) => {
  const response = await request.get(src);
  expect(response.status(), src).toBe(200);
  expect(response.headers()['content-type'], src).toBe('image/png');
  expect(pngSize(await response.body()), src).toBe(sizes);
};

/** Loads a page and waits until the service worker controls it (it claims open pages). */
const openControlled = async (page: Page, path: string) => {
  await routeTiles(page);
  await page.goto(path);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
    timeout: 30_000,
  });
};

test('serves a localized manifest whose icons and screenshots exist at their stated sizes', async ({
  request,
}) => {
  const response = await request.get('/manifest.webmanifest', {
    headers: { 'Accept-Language': 'ro' },
  });
  expect(response.status()).toBe(200);
  const manifest = await response.json();

  expect(manifest).toMatchObject({
    name: 'Power Grid Operations',
    short_name: 'Grid Ops',
    lang: 'ro',
    start_url: '/',
    display: 'standalone',
  });
  expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
    '/alarms',
    '/map',
    '/incidents/new',
  ]);
  expect(manifest.shortcuts[2].name).toBe('Incident nou');

  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain('any');
  expect(purposes).toContain('maskable');
  for (const image of [...manifest.icons, ...manifest.screenshots]) {
    await expectPng(request, image);
  }
});

test('links the manifest, icons and theme colours from every page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
});

test('works offline: visited pages, incident reports and the offline fallback', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await openControlled(page, '/');

  // Opened once online, so the service worker has the page and IndexedDB has the reports.
  await page.goto('/incidents');
  const table = page.getByRole('table', { name: 'Incident reports' });
  await expect(table.getByRole('row').nth(1)).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(table.getByRole('row').nth(1)).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toBeVisible();

  // Never opened on this device: the precached offline page instead of a browser error.
  await page.goto('/network');
  await expect(page.getByRole('heading', { level: 1, name: 'You are offline' })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toBeHidden();
});
