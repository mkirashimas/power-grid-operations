import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The graph's nodes and edges are a visual layer (not keyboard stops); the asset tree is
    // the accessible path through the network. The graph's region, controls and minimap are
    // still checked.
    .exclude('.react-flow__viewport')
    .analyze();
  expect(results.violations).toEqual([]);
};

const tree = (page: Page) => page.getByRole('tree', { name: 'Assets by zone and substation' });
const graph = (page: Page) => page.getByTestId('topology-graph');
const bar = (page: Page) => page.getByTestId('selection-bar');
const changes = (page: Page) => page.getByRole('list', { name: 'Changes' }).getByRole('listitem');

const openNetwork = async (page: Page, search = '') => {
  await page.goto(`/network${search}`);
  await expect(tree(page)).toBeVisible();
  await expect(graph(page).locator('.react-flow__node').first()).toBeVisible();
};

test.use({ locale: 'en-US' });

test('shows the asset tree, the topology graph and the what-if editor', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openNetwork(page);

  await expect(
    page.getByRole('region', { name: 'Network graph: 400 substations and 769 lines' }),
  ).toBeVisible();
  await expect(tree(page).getByRole('treeitem', { name: 'Coast' })).toBeVisible();
  await expect(page.getByTestId('what-if-panel')).toContainText('Select a line');
  // The minimap draws every substation, in a status colour.
  const minimapNodes = graph(page).locator('.react-flow__minimap-node');
  await expect(minimapNodes).toHaveCount(400);
  const fill = await minimapNodes.first().evaluate((node) => getComputedStyle(node).fill);
  expect(fill).toMatch(/^rgb\(/);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('selecting in the tree selects the asset everywhere', async ({ page }) => {
  await openNetwork(page);
  await tree(page).getByRole('treeitem', { name: 'Coast' }).click();
  await tree(page)
    .getByRole('treeitem', { name: /^CST-001 138 kV/ })
    .click();

  await expect(bar(page)).toContainText('CST-001 138 kV');
  await expect(page).toHaveURL(/asset=sub-cst-001/);
  // The graph labels the selected substation.
  await expect(graph(page)).toContainText('CST-001 138 kV');
  await expect(page.getByRole('slider', { name: 'Load at CST-001 138 kV' })).toBeVisible();
});

test('moves through the tree and selects with the keyboard', async ({ page }) => {
  await openNetwork(page);
  await tree(page).getByRole('treeitem', { name: 'Coast' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  // Space selects (Enter expands an item that has children).
  await page.keyboard.press('Space');
  await expect(bar(page)).toContainText('CST-001 138 kV');
});

test('tripping a line studies its effect, kept in the URL, and Reset clears it', async ({
  page,
}) => {
  await openNetwork(page, '?asset=ln-0001');
  await page.getByRole('button', { name: 'Trip line' }).click();

  await expect(page).toHaveURL(/mode=study/);
  await expect(page).toHaveURL(/study=t\.ln-0001/);
  await expect(changes(page)).toHaveCount(1);
  const results = page.getByTestId('study-results');
  await expect(results.getByRole('row', { name: /L0001 .* Tripped/ })).toBeVisible();
  await expect(results.getByRole('row')).not.toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Restore line' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset study' }).click();
  await expect(page.getByText('No changes yet.')).toBeVisible();
  await expect(page).not.toHaveURL(/study=/);
});

test('a shared study link restores its changes, and each can be undone', async ({ page }) => {
  await openNetwork(page, '?mode=study&study=t.ln-0001~l.sub-cst-001.20');
  await expect(changes(page)).toHaveCount(2);
  await expect(changes(page).nth(1)).toContainText('Load at CST-001 138 kV +20 %');

  await page.getByRole('button', { name: /^Undo: L0001/ }).click();
  await expect(changes(page)).toHaveCount(1);
  await expect(page).toHaveURL(/study=l\.sub-cst-001\.20$/);
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await openNetwork(page, '?asset=ln-0001&mode=study&study=t.ln-0001');
  await expect(page.getByTestId('study-results')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
