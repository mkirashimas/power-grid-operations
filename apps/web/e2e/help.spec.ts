import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPage, PAGES } from './support/pages';

// Section help (M13): a side panel that pushes the page and folds the sidebar on desktop, a
// bottom sheet on phones.

test.use({ locale: 'en-US' });

const appPage = (name: string) => PAGES.find((candidate) => candidate.name === name)!;

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');
  test.use({ viewport: { width: 1280, height: 800 } });

  test('help pushes the map aside, folds the sidebar and closes with Escape', async ({ page }) => {
    await openPage(page, appPage('map'));
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const helpButton = page.getByRole('button', { name: 'About this section' });

    await helpButton.click();

    const panel = page.getByRole('complementary', { name: 'About Map' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'How do I use it?' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'About Map' })).toBeFocused();
    await expect(nav.getByRole('button', { name: 'Expand menu' })).toBeVisible();

    // The map follows its container: its canvas never runs under the panel.
    await expect(async () => {
      const panelBox = (await panel.boundingBox())!;
      const mapBox = (await page.getByTestId('asset-map').locator('canvas').boundingBox())!;
      expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(panelBox.x + 1);
    }).toPass();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    await page.keyboard.press('Escape');

    await expect(panel).toBeHidden();
    await expect(helpButton).toBeFocused();
    await expect(nav.getByRole('button', { name: 'Collapse menu' })).toBeVisible();
  });

  test('help stays open across sections and shows the new section', async ({ page }) => {
    await openPage(page, appPage('map'));
    await page.getByRole('button', { name: 'About this section' }).click();
    await expect(page.getByRole('complementary', { name: 'About Map' })).toBeVisible();

    await page.getByRole('link', { name: 'Network' }).click();

    await expect(page.getByRole('complementary', { name: 'About Network' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Network' })).toBeVisible();
  });

  test('a collapsed sidebar survives a reload, rendered by the server', async ({ page }) => {
    await openPage(page, appPage('overview'));
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('button', { name: 'Collapse menu' }).click();
    await expect(nav.getByRole('link', { name: 'Telemetry' })).not.toContainText('Telemetry');

    // No JavaScript: the server markup alone must already be the rail.
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('aria-label="Expand menu"');

    await page.reload();
    await expect(nav.getByRole('button', { name: 'Expand menu' })).toBeVisible();
  });
});

test.describe('phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only');

  test('help opens as a bottom sheet without horizontal scroll', async ({ page }) => {
    await openPage(page, appPage('telemetry'));

    await page.getByRole('button', { name: 'About this section' }).click();

    const sheet = page.getByRole('dialog', { name: 'About Telemetry' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'What is this?' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

    await sheet.getByRole('button', { name: 'Close help' }).click();
    await expect(sheet).toBeHidden();
  });
});
