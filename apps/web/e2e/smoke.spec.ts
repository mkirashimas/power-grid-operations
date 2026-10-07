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
  await expectNoAxeViolations(page);
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
