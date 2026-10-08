import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TOTAL = '1,076,544';

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

/** Opens the page and waits until the worker has generated and queried the data. */
const openTelemetry = async (page: Page, search = '') => {
  await page.goto(`/telemetry${search}`);
  const readout = page.getByTestId('telemetry-readout');
  await expect(readout).toContainText(`of ${TOTAL} rows`, { timeout: 30_000 });
  await expect(readout).not.toContainText('Updating');
  return readout;
};

const settled = async (page: Page) =>
  expect(page.getByTestId('telemetry-readout')).not.toContainText('Updating');

/** Parses a number formatted for en-US, e.g. "1,234.5". */
const parse = (text: string | null) => Number((text ?? '').replace(/,/g, ''));

test.use({ locale: 'en-US' });

test('loads every row into a virtual grid and passes axe in light and dark mode', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const readout = await openTelemetry(page);

  await expect(readout).toContainText(`${TOTAL} of ${TOTAL} rows`);
  const grid = page.getByRole('grid', { name: 'Telemetry rows' });
  await expect(grid).toHaveAttribute('aria-rowcount', '1076545');
  // Only a window of rows is in the DOM.
  expect(await grid.getByRole('row').count()).toBeLessThan(60);
  await expect(page.getByText('Synthetic').first()).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('sorts by MW descending and keeps the sort in the URL', async ({ page }) => {
  await openTelemetry(page);

  const header = page.getByRole('columnheader', { name: 'MW' });
  await header.click();
  await settled(page);
  await header.click();
  await settled(page);
  await expect(header).toHaveAttribute('aria-sort', 'descending');
  await expect(page).toHaveURL(/sort=mw%3Adesc/);

  const mw = page.locator('[role="row"][aria-rowindex] [aria-colindex="5"]');
  const [first, second, third] = (await mw.allTextContents()).slice(1, 4).map(parse);
  expect(first).toBeGreaterThanOrEqual(second);
  expect(second).toBeGreaterThanOrEqual(third);

  // Opening the shared URL restores the view.
  await openTelemetry(page, '?sort=mw%3Adesc');
  await expect(page.getByRole('columnheader', { name: 'MW' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
});

test('filters by asset and offers to clear filters when nothing matches', async ({ page }) => {
  const readout = await openTelemetry(page);

  await page.getByRole('searchbox', { name: 'Filter assets' }).fill('CST-001');
  await expect(readout).not.toContainText(`${TOTAL} of`);
  await settled(page);
  const assets = await page
    .locator('[role="row"][aria-rowindex] [aria-colindex="1"][role="gridcell"]')
    .allTextContents();
  expect(assets.length).toBeGreaterThan(0);
  assets.forEach((name) => expect(name).toContain('CST-001'));

  await page.getByRole('searchbox', { name: 'Filter assets' }).fill('no-such-asset');
  await expect(page.getByRole('heading', { name: 'No rows match these filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(readout).toContainText(`${TOTAL} of ${TOTAL} rows`);
});

test('groups by zone into a treegrid with expandable groups', async ({ page }) => {
  await openTelemetry(page);

  await page.getByRole('combobox', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'Zone' }).click();
  const grid = page.getByRole('treegrid', { name: 'Telemetry rows' });
  await expect(grid).toBeVisible();
  await settled(page);

  const groups = grid.locator('[role="row"][aria-level="1"]');
  await expect(groups).toHaveCount(8);
  await expect(groups.first()).toHaveAttribute('aria-expanded', 'false');

  await groups.first().getByRole('gridcell').click();
  await settled(page);
  await expect(groups.first()).toHaveAttribute('aria-expanded', 'true');
  await expect(grid.locator('[role="row"][aria-level="2"]').first()).toBeVisible();
  await expectNoAxeViolations(page);
});

test('is fully operable from the keyboard, scrolling far rows into view', async ({ page }) => {
  await openTelemetry(page);

  const assetHeader = page.getByRole('columnheader', { name: 'Asset' });
  await assetHeader.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-cell="0:0"]')).toBeFocused();

  await page.keyboard.press('Control+End');
  const last = page.locator('[data-cell="1076543:7"]');
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();

  await page.keyboard.press('Control+Home');
  await expect(page.locator('[data-cell="0:0"]')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(page.locator('[role="gridcell"]:focus')).toHaveAttribute(
    'data-cell',
    /^[1-9]\d*:0$/,
  );

  // Enter on a header sorts.
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('ArrowUp');
  await expect(assetHeader).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(assetHeader).toHaveAttribute('aria-sort', 'ascending');
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await openTelemetry(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
