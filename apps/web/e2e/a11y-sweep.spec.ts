import { expect, test } from '@playwright/test';
import { openPage, PAGES } from './support/pages';

// What axe can't check on its own (axe runs in every page's own spec): the page outline, reflow
// at 320 CSS px (WCAG 1.4.10, the width of a 1280 px screen at 400 % zoom), reduced motion
// and forced colors.

test.use({ locale: 'en-US' });

test.describe('page structure', () => {
  test.skip(({ isMobile }) => isMobile, 'the outline is the same on every viewport');

  for (const appPage of PAGES) {
    test(`${appPage.name}: one h1, no skipped heading levels, and the landmarks`, async ({
      page,
    }) => {
      await openPage(page, appPage);
      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((headings) =>
          headings
            .filter((heading) => heading.getClientRects().length > 0)
            .map((heading) => Number(heading.tagName[1])),
        );
      expect(levels.filter((level) => level === 1)).toHaveLength(1);
      levels.forEach((level, index) => {
        if (index > 0) expect(level - levels[index - 1], `heading ${index}`).toBeLessThanOrEqual(1);
      });
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(1);
    });
  }
});

test.describe('reflow at 320 CSS px', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile project only');
  test.use({ viewport: { width: 320, height: 640 } });

  for (const appPage of PAGES) {
    test(`${appPage.name}: no horizontal page scroll`, async ({ page }) => {
      await openPage(page, appPage);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('reduced motion', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');
  test.use({ reducedMotion: 'reduce' });

  test('dialogs and menus open without animating', async ({ page }) => {
    await openPage(
      page,
      PAGES.find(({ name }) => name === 'incidents')!,
    );
    await page.getByRole('button', { name: 'Reset demo data' }).click();
    const duration = await page
      .getByRole('dialog')
      .evaluate(
        (dialog) => getComputedStyle(dialog.closest('.MuiDialog-container')!).transitionDuration,
      );
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});

test.describe('forced colors (Windows high contrast)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('keyboard focus stays visible without colour and shadows', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openPage(
      page,
      PAGES.find(({ name }) => name === 'incidents')!,
    );
    // Tab to the sidebar's first link (after the skip link and the top bar's controls).
    const link = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link')
      .first();
    for (let step = 0; step < 15; step += 1) {
      await page.keyboard.press('Tab');
      if (await link.evaluate((element) => element === document.activeElement)) break;
    }
    const outline = await link.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThan(0);

    // Status keeps its icon and text, not colour alone.
    const chip = page.locator('[data-status="alarm"]').first();
    await expect(chip.locator('svg')).toBeVisible();
    await expect(chip).toHaveText('Alarm');
  });
});
