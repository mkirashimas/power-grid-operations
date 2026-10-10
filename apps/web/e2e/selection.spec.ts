import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const telemetryGrid = (page: Page) => page.getByRole('grid', { name: 'Telemetry rows' });
const bar = (page: Page) => page.getByTestId('selection-bar');

/** Opens telemetry and selects the asset of the first row; returns its name and the URL id. */
const selectFirstTelemetryAsset = async (page: Page) => {
  await page.goto('/telemetry');
  const firstRow = telemetryGrid(page).getByRole('row').nth(1);
  const name = (await firstRow.getByRole('gridcell').first().textContent())!;
  await firstRow.getByRole('gridcell').nth(3).click();
  await expect(bar(page)).toContainText(name);
  await expect(page).toHaveURL(/[?&]asset=[a-z0-9-]+/);
  const id = new URL(page.url()).searchParams.get('asset')!;
  return { name, id };
};

test.use({ locale: 'en-US' });

test('selecting a telemetry row selects its asset everywhere on the page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const { name } = await selectFirstTelemetryAsset(page);

  // Every row of the asset is selected (rows are ordered by asset, then time).
  const rows = telemetryGrid(page).getByRole('row');
  await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(rows.nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(
    page
      .getByRole('region', { name: `Selected asset: ${name}` })
      .getByRole('img')
      .first(),
  ).toHaveAttribute('aria-label', /^Power, /);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('the selection follows to the alarm feed, with live values', async ({ page }) => {
  const { name, id } = await selectFirstTelemetryAsset(page);

  await bar(page).getByRole('link', { name: 'Open in Alarms' }).click();
  await expect(page).toHaveURL(new RegExp(`/alarms\\?asset=${id}$`));
  await expect(bar(page)).toContainText(name);
  // The server sends the watched asset every tick.
  await expect(page.getByTestId('selected-asset-live')).toContainText(/Loading .+ %.*Voltage/, {
    timeout: 15_000,
  });

  await page.getByLabel('Only the selected asset').check();
  const rows = page.getByRole('grid', { name: 'Alarms' }).getByRole('row');
  const count = await rows.count();
  for (let i = 1; i < count; i += 1) {
    await expect(rows.nth(i)).toContainText(name);
  }
});

test('selecting an alarm row selects its asset', async ({ page }) => {
  await page.goto('/alarms');
  const grid = page.getByRole('grid', { name: 'Alarms' });
  await expect(grid.getByRole('row').nth(1)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  const firstRow = grid.getByRole('row').nth(1);
  const asset = (await firstRow.getByRole('gridcell').nth(2).textContent())!.split(' · ')[0];

  await firstRow.getByRole('gridcell').first().click();
  await expect(bar(page)).toContainText(asset);
  await expect(firstRow).toHaveAttribute('aria-selected', 'true');
});

test('a shared link restores the selection, and Clear removes it', async ({ page }) => {
  await page.goto('/charts?asset=sub-cst-001');
  await expect(bar(page)).toBeVisible();
  await expect(bar(page).getByRole('link', { name: 'Open in Telemetry' })).toBeVisible();
  await expect(bar(page).getByRole('link', { name: 'Open in Alarms' })).toBeVisible();

  // The chart range shares the URL with the selection.
  await expect(page.getByTestId('highres-stats')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '24 h' }).click();
  await expect(page).toHaveURL(/asset=sub-cst-001/);
  await expect(page).toHaveURL(/from=.+&to=/);

  await bar(page).getByRole('button', { name: 'Clear selection' }).click();
  await expect(bar(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/asset=/);
  await expect(page).toHaveURL(/from=.+&to=/);
});

test('ignores an unknown asset in the URL', async ({ page }) => {
  await page.goto('/telemetry?asset=not-an-asset');
  await expect(telemetryGrid(page)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
});

test('selects a row from the keyboard', async ({ page }) => {
  await page.goto('/telemetry');
  const grid = telemetryGrid(page);
  await expect(grid.getByRole('row').nth(1)).toBeVisible();
  await grid.getByRole('columnheader').first().focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(bar(page)).toBeVisible();
  await expect(grid.getByRole('row').nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('has no horizontal page scroll on narrow screens with a selection', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile only');
  await selectFirstTelemetryAsset(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
