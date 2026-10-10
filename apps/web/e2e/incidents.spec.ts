import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const SAMPLE_PDF = readFileSync(
  new URL('../public/samples/incidents/switching-order.pdf', import.meta.url),
);

const table = (page: Page) => page.getByRole('table', { name: 'Incident reports' });
const rows = (page: Page) => table(page).getByRole('row');
const editor = (page: Page) => page.getByRole('textbox', { name: 'Report text' });
const viewer = (page: Page) => page.getByTestId('pdf-viewer');
const firstPage = (page: Page) => viewer(page).locator('[data-page-number="1"]');

const openList = async (page: Page, search = '') => {
  await page.goto(`/incidents${search}`);
  await expect(table(page)).toBeVisible();
};

const openReport = async (page: Page, id: string, search = '') => {
  await page.goto(`/incidents/${id}${search}`);
  await expect(editor(page)).toBeVisible();
};

const switchToDark = async (page: Page) => {
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
};

test.use({ locale: 'en-US' });

test('lists the sample reports, with filters kept in the URL', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openList(page);
  // A header row and the seven samples.
  await expect(rows(page)).toHaveCount(8);
  await expect(page.getByText('Reports: 7')).toBeVisible();
  await expectNoAxeViolations(page);
  await switchToDark(page);
  await expectNoAxeViolations(page);

  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Open' }).click();
  await expect(page).toHaveURL(/status=open/);
  await expect(rows(page)).toHaveCount(3);
  await expect(table(page)).toContainText('CST Gas 003 forced outage');

  await page.goto('/incidents?q=insulator');
  await expect(rows(page)).toHaveCount(2);
  await expect(table(page)).toContainText('L0001 tripped');
  await expect(page.getByRole('searchbox', { name: 'Search reports' })).toHaveValue('insulator');
});

test('writes a new report that survives a reload', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'New incident' }).click();
  await expect(page).toHaveURL(/\/incidents\/inc-[0-9a-f]{8}$/);

  await editor(page).click();
  await page.keyboard.type('Breaker opened at ');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('14:02');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type(' near @cst-001');
  const suggestions = page.getByRole('listbox', { name: 'Assets' });
  await expect(suggestions.getByRole('option').first()).toHaveText(/CST-001 138 kV/);
  await expect(editor(page)).toHaveAttribute('aria-activedescendant', /option-0$/);
  await page.keyboard.press('Enter');
  await expect(suggestions).toBeHidden();
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved');

  await page.getByRole('textbox', { name: 'Title' }).fill('Breaker trip at CST-001');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Breaker trip at CST-001');
  await expect(page.getByTestId('save-status')).toHaveText('All changes saved');

  await page.reload();
  await expect(editor(page).locator('strong')).toHaveText('14:02');
  await expect(editor(page).locator('[data-type="mention"]')).toHaveText('@CST-001 138 kV');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Breaker trip at CST-001');
  // The mention links the asset to the report.
  await expect(page.getByRole('list', { name: 'Assets' })).toContainText('CST-001 138 kV');

  // Clicking the mention selects the asset everywhere.
  await editor(page).locator('[data-type="mention"]').click();
  await expect(page.getByTestId('selection-bar')).toContainText('CST-001 138 kV');
  await expect(page).toHaveURL(/asset=sub-cst-001/);
});

test('opens a sample PDF, searches it and keeps the page in the URL', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openReport(page, 'inc-sample-01');
  await page.getByRole('button', { name: /^relay-event-record\.pdf/ }).click();

  await expect(page).toHaveURL(/doc=att-sample-relay/);
  await expect(firstPage(page)).toHaveAttribute('data-rendered', 'true');
  await expect(viewer(page).getByText('of 2', { exact: true })).toBeVisible();
  // The text layer makes the PDF's text available.
  await expect(firstPage(page).locator('.textLayer')).toContainText('Relay event record');
  await expectNoAxeViolations(page);
  await switchToDark(page);
  await expectNoAxeViolations(page);

  await viewer(page).getByRole('searchbox', { name: 'Find in document' }).fill('insulator');
  // Both hits are on page 2: the finding and the recommendation.
  await expect(viewer(page).getByTestId('pdf-matches')).toHaveText('1 of 2');
  const secondPage = viewer(page).locator('[data-page-number="2"]');
  await expect(secondPage.locator('.hit')).toHaveCount(2);
  await expect(secondPage.locator('.hit.active')).toContainText('damaged insulator');
  await viewer(page).getByRole('button', { name: 'Next match' }).click();
  await expect(viewer(page).getByTestId('pdf-matches')).toHaveText('2 of 2');
  await expect(secondPage.locator('.hit.active')).toContainText('replace the insulator');
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('textbox', { name: 'Page' })).toHaveValue('2');

  // Zoom changes the drawn size.
  const before = (await firstPage(page).boundingBox())!.width;
  await viewer(page).getByRole('button', { name: 'Zoom in' }).click();
  await expect
    .poll(async () => (await firstPage(page).boundingBox())!.width)
    .toBeGreaterThan(before);

  // A shared link opens the same document and page.
  await page.reload();
  await expect(viewer(page).locator('[data-page-number="2"]')).toHaveAttribute(
    'data-rendered',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Page' })).toHaveValue('2');
});

test('moves between pages with the keyboard', async ({ page }) => {
  await openReport(page, 'inc-sample-01', '?doc=att-sample-relay');
  await expect(firstPage(page)).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('region', { name: 'Document: relay-event-record.pdf' }).focus();
  await page.keyboard.press('PageDown');
  await expect(page).toHaveURL(/page=2/);
  await page.keyboard.press('PageUp');
  await expect(page).not.toHaveURL(/page=/);
});

test('attaches an uploaded PDF and rejects other files', async ({ page }) => {
  await openReport(page, 'inc-sample-03');
  await expect(page.getByText('No attachments yet.', { exact: false })).toBeVisible();
  const input = page.getByTestId('attach-input');

  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hi'),
  });
  await expect(page.getByRole('region', { name: 'Attachments' }).getByRole('alert')).toHaveText(
    'notes.txt is not a PDF.',
  );

  await input.setInputFiles({
    name: 'my-record.pdf',
    mimeType: 'application/pdf',
    buffer: SAMPLE_PDF,
  });
  await expect(page.getByRole('button', { name: /^my-record\.pdf/ })).toBeVisible();
  await expect(firstPage(page)).toHaveAttribute('data-rendered', 'true');
  await expect(firstPage(page).locator('.textLayer')).toContainText('Switching order');

  // Uploads persist in this browser.
  await page.reload();
  await expect(firstPage(page)).toHaveAttribute('data-rendered', 'true');
  await page.getByRole('button', { name: 'Remove my-record.pdf' }).click();
  await expect(page.getByRole('button', { name: /^my-record\.pdf/ })).toBeHidden();
  await expect(viewer(page)).toBeHidden();
});

test('Report incident in the selection bar starts a report for the asset', async ({ page }) => {
  await page.goto('/incidents?asset=sub-cst-001');
  await page.getByTestId('selection-bar').getByRole('link', { name: 'Report incident' }).click();
  await expect(page).toHaveURL(/\/incidents\/inc-[0-9a-f]{8}/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'CST-001 138 kV: Untitled incident',
  );
  await expect(page.getByRole('list', { name: 'Assets' })).toContainText('CST-001 138 kV');
});

test('Reset demo data restores the samples', async ({ page }) => {
  await openReport(page, 'inc-sample-02');
  await page.getByRole('button', { name: 'Delete report' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(rows(page)).toHaveCount(7);

  await page.getByRole('button', { name: 'Reset demo data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click();
  await expect(rows(page)).toHaveCount(8);
});

test('an unknown report says so', async ({ page }) => {
  await page.goto('/incidents/inc-missing');
  await expect(page.getByRole('heading', { name: 'Report not found' })).toBeVisible();
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  for (const path of ['/incidents', '/incidents/inc-sample-01?doc=att-sample-relay']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path.includes('doc='))
      await expect(firstPage(page)).toHaveAttribute('data-rendered', 'true');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
