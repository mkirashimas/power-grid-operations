import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// A minimal base style instead of OpenFreeMap, so the tests don't depend on the network. It keeps
// an attribution, like the real styles, so the attribution control has something to show.
const MINIMAL_STYLE = {
  version: 8,
  sources: {
    base: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © OpenMapTiles',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#e8eaed' } },
    { id: 'base', type: 'fill', source: 'base' },
  ],
};

const routeTiles = (page: Page) =>
  page.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: MINIMAL_STYLE })
      : route.abort(),
  );

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const openMap = async (page: Page, search = '') => {
  await routeTiles(page);
  await page.goto(`/map${search}`);
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'live', {
    timeout: 30_000,
  });
};

const canvas = (page: Page) => page.getByTestId('asset-map').locator('canvas');

test.use({ locale: 'en-US' });

test('draws the live grid on the map, with credits', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openMap(page);

  await expect(canvas(page)).toBeVisible();
  await expect(canvas(page)).toHaveAttribute(
    'aria-label',
    /^Map of 1,869 grid assets in Texas: \d+ in alarm, \d+ in warning/,
  );
  await expect(page.getByTestId('asset-map').getByText('OpenFreeMap')).toBeVisible();
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();
  await expect(page.getByText('Synthetic').first()).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(canvas(page)).toBeVisible();
  await expectNoAxeViolations(page);
});

test('layer toggles are kept in the URL', async ({ page }) => {
  await openMap(page);
  await page.getByRole('checkbox', { name: 'Lines (769)' }).uncheck();
  await expect(page).toHaveURL(/layers=loads%2Cgenerators%2Csubstations/);

  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Lines (769)' })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Substations (400)' })).toBeChecked();
});

test('lists every asset in a table and selects from it', async ({ page }) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Show as table' }).click();
  const grid = page.getByRole('grid', { name: 'Assets' });
  await expect(grid).toHaveAttribute('aria-rowcount', '1870');
  // Live values from the first message, worst loading first.
  const firstRow = grid.getByRole('row').nth(1);
  await expect(firstRow).toContainText(/\d+\.\d %.*\d\.\d{3} pu/);
  // Sorted by name, so rows keep their place while live values change.
  await grid.getByRole('columnheader', { name: 'Asset' }).click();

  const name = (await firstRow.getByRole('gridcell').first().textContent())!;
  await firstRow.getByRole('gridcell').first().click();
  await expect(page.getByTestId('map-asset-panel')).toContainText(name);
  await expect(page.getByTestId('map-asset-panel')).toContainText(/Loading\s*\d+\.\d %/);
  await expect(page.getByTestId('selection-bar')).toContainText(name);
  await expect(page).toHaveURL(/asset=/);
});

test('opens with the asset from the URL selected', async ({ page }) => {
  await openMap(page, '?asset=sub-cst-001');
  const name = (await page.getByTestId('selection-bar').locator('p').nth(1).textContent())!;
  await expect(page.getByTestId('map-asset-panel').getByRole('heading')).toHaveText(name);
  await expect(page.getByTestId('map-asset-panel')).toContainText('Substation');
});

test('clicking an asset on the map selects it', async ({ page, isMobile }) => {
  // The map opens centred on the asset from the URL; clear the selection, then click it.
  await openMap(page, '?asset=sub-cst-001');
  const name = (await page.getByTestId('selection-bar').locator('p').nth(1).textContent())!;
  // The map reads ?asset= when it is created, and clicking only works once MapLibre's worker
  // has drawn the assets: wait for both before Clear removes the parameter.
  await expect(page.getByTestId('asset-map')).toHaveAttribute('data-ready', 'true', {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByTestId('selection-bar')).toHaveCount(0);
  const { width, height } = (await canvas(page).boundingBox())!;
  const position = { x: width / 2, y: height / 2 };
  // Phones tap (MapLibre's touch handlers); desktops click.
  if (isMobile) await canvas(page).tap({ position });
  else await canvas(page).click({ position });
  await expect(page.getByTestId('selection-bar')).toContainText(name);
  await expect(page).toHaveURL(/asset=sub-cst-001/);
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await openMap(page);
  await expect(canvas(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
