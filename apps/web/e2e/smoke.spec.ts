import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

test.use({ locale: 'en-US' });

test('renders the overview and passes axe in light and dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');

  await expect(page).toHaveTitle('Power Grid Operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Grid overview' })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  // Dark background.default (#232527) is applied before axe measures contrast.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(35, 37, 39)');
  // The click leaves the pointer on the toggle, which opens its tooltip. axe would measure the
  // tooltip mid-fade (semi-transparent text), so move away and let it close first.
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('shows ERCOT figures credited to EIA and the synthetic grid model', async ({ page }) => {
  await page.goto('/');

  const ercot = page.getByRole('region', { name: 'ERCOT, latest hour' });
  for (const label of ['Demand', 'Day-ahead forecast', 'Forecast error', 'Net interchange']) {
    await expect(ercot.getByRole('heading', { level: 3, name: label })).toBeVisible();
  }
  await expect(ercot.getByText(/\d MW/).first()).toBeVisible();
  await expect(
    ercot.getByRole('link', { name: 'U.S. Energy Information Administration' }),
  ).toHaveAttribute('href', 'https://www.eia.gov/opendata/');

  const model = page.getByRole('region', { name: 'Grid model' });
  await expect(model.getByText('Synthetic').first()).toBeVisible();
  await expect(model.getByText('This is not EIA data.', { exact: false })).toBeVisible();
  for (const label of ['Substations', 'Lines', 'Generators', 'Loads']) {
    await expect(model.getByRole('heading', { level: 3, name: label })).toBeVisible();
  }
});

test('serves EIA data and synthetic assets from the API', async ({ request }) => {
  const ercot = await (await request.get('/api/eia/ercot')).json();
  expect(ercot.source).toBe('U.S. Energy Information Administration');
  expect(ercot.series.map((series: { id: string }) => series.id)).toEqual(
    expect.arrayContaining(['demand', 'forecast', 'generation', 'interchange']),
  );

  const assets = await (await request.get('/api/assets')).json();
  expect(assets).toMatchObject({ synthetic: true, label: 'Synthetic' });
  expect(assets.count).toBeGreaterThan(1800);
});

test('switches language and keeps it after a reload', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'Română' }).click();

  const heading = page.getByRole('heading', { level: 1, name: 'Prezentarea rețelei' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(heading).toBeVisible();

  await page.reload();
  await expect(heading).toBeVisible();
});

test.describe('first visit in Spanish', () => {
  test.use({ locale: 'es-ES' });

  test('uses the browser language', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1, name: 'Resumen de la red' })).toBeVisible();
  });
});

test('shows a translated 404 page', async ({ page }) => {
  const response = await page.goto('/does-not-exist');

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test('has no horizontal scroll and a working menu on narrow screens', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('presentation');
    await expect(drawer.getByRole('link', { name: 'Overview' })).toBeVisible();
  }
});
