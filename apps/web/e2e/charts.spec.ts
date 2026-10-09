import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PANES = [
  'Demand vs day-ahead forecast',
  'Generation by fuel',
  'Net interchange (negative = import)',
  '1-second system load',
];

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const openCharts = async (page: Page, search = '') => {
  await page.goto(`/charts${search}`);
  // The 1-second series is generated in a worker; wait for its draw statistics.
  await expect(page.getByTestId('highres-stats')).toBeVisible({ timeout: 30_000 });
};

const chart = (page: Page, title: string) =>
  page.getByRole('region', { name: title }).getByRole('img');

test.use({ locale: 'en-US' });

test('draws four panes with EIA credit and the downsampled synthetic series', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openCharts(page);

  for (const title of PANES) {
    await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
    await expect(chart(page, title)).toHaveAttribute(
      'aria-label',
      new RegExp(title.replace(/[()]/g, '\\$&')),
    );
  }
  await expect(
    page.getByRole('link', { name: 'U.S. Energy Information Administration' }),
  ).toBeVisible();
  await expect(page.getByText('Synthetic').first()).toBeVisible();
  // Hundreds of thousands of points in a 7-day window, drawn as a few thousand.
  // Downsampled by default with Rust/WASM min/max in the worker.
  await expect(page.getByTestId('highres-stats')).toHaveText(
    /^[\d,]{7,} → [\d,]{3,5} points · WASM Min\/max in [\d.]+ ms in a worker · drawn in [\d.]+ ms$/,
  );
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('zooms with the keyboard and keeps the range in the URL', async ({ page }) => {
  await openCharts(page);
  const range = page.getByTestId('chart-range');
  const before = await range.textContent();

  await chart(page, PANES[0]).focus();
  await page.keyboard.press('+');
  await expect(range).not.toHaveText(before!);
  await expect(page).toHaveURL(/from=.+&to=.+/);

  const url = page.url();
  const zoomed = await range.textContent();
  await page.goto(url);
  await expect(page.getByTestId('chart-range')).toHaveText(zoomed!);
});

test('moves the crosshair in every pane at once', async ({ page }) => {
  await openCharts(page);

  await chart(page, PANES[0]).focus();
  await page.keyboard.press('End');
  const readouts = page.getByTestId('chart-readout');
  await expect(readouts).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) {
    await expect(readouts.nth(i)).toContainText('MW');
  }
  await page.keyboard.press('Escape');
  await expect(readouts.first()).toBeEmpty();
});

test('drags the overview window to move the range', async ({ page }) => {
  await openCharts(page);
  await page.getByRole('button', { name: '24 h' }).click();
  const range = page.getByTestId('chart-range');
  const before = await range.textContent();

  const window = page.getByTestId('overview-window');
  // It sits below the panes; mouse coordinates only hit what is in the viewport.
  await window.scrollIntoViewIfNeeded();
  const box = (await window.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 200, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(range).not.toHaveText(before!);
});

test('lists the visible data as a table', async ({ page }) => {
  await openCharts(page);

  const pane = page.getByRole('region', { name: PANES[0] });
  await pane.getByRole('button', { name: 'Show as table' }).click();
  const grid = pane.getByRole('grid', { name: PANES[0] });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('columnheader', { name: 'Day-ahead forecast' })).toBeVisible();
  await expect(grid.getByRole('gridcell').first()).toContainText(/\d/);
});

test('switches the downsampling engine and algorithm, and keeps them in the URL', async ({
  page,
}) => {
  await openCharts(page);
  const stats = page.getByTestId('highres-stats');
  const engine = page.getByRole('group', { name: 'Engine' });
  const algorithm = page.getByRole('group', { name: 'Algorithm' });
  await expect(engine.getByRole('button', { name: 'WASM' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await engine.getByRole('button', { name: 'JS' }).click();
  await expect(stats).toContainText('JS Min/max');
  await algorithm.getByRole('button', { name: 'LTTB' }).click();
  await expect(stats).toContainText('JS LTTB');
  await expect(page).toHaveURL(/engine=js&algo=lttb/);

  await page.goto(page.url());
  await expect(page.getByTestId('highres-stats')).toContainText('JS LTTB', { timeout: 30_000 });
  await expect(
    page.getByRole('group', { name: 'Algorithm' }).getByRole('button', { name: 'LTTB' }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('benchmarks JS against WASM in the worker', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openCharts(page);

  await page.getByRole('button', { name: 'Run benchmark' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Benchmark finished.' })).toBeVisible({
    timeout: 60_000,
  });
  const table = page.getByRole('table', { name: /Median of 7 runs/ });
  // 3 ranges × 2 algorithms, plus the header row.
  await expect(table.getByRole('row')).toHaveCount(7);
  await expect(table.getByRole('row').nth(1)).toContainText(/24 h.*Min\/max.*ms.*ms.*×/);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await openCharts(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
