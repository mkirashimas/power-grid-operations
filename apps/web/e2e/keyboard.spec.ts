import { expect, test, type Page } from '@playwright/test';
import { openPage, PAGES } from './support/pages';

// Keyboard-only use (WCAG 2.1.1, 2.1.2, 2.4.7): every stop on the Tab path shows a visible focus
// indicator, and Tab keeps moving (no traps).

const STOPS = 30;
const MAX_STOPS_PER_ELEMENT = 8;

interface Stop {
  /** Unique per element, so two controls with the same text don't look like a trap. */
  id: string;
  name: string;
  visible: boolean;
}

/**
 * The focused element, and whether focus shows: an outline or shadow on the element, on the
 * MUI control that wraps it (checkboxes, Mui-focusVisible), on a tree item's content row, or a
 * focused text field's border (Mui-focused).
 */
const focusedStop = (page: Page): Promise<Stop | null> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return null;
    const shows = (target: Element | null | undefined) => {
      if (!target) return false;
      const style = getComputedStyle(target);
      return (
        (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
      );
    };
    const visible =
      shows(element) ||
      shows(element.closest('.Mui-focusVisible')) ||
      (element.getAttribute('role') === 'treeitem' && shows(element.firstElementChild)) ||
      Boolean(element.closest('.Mui-focused'));
    element.dataset.tabStop ??= String(Math.random());
    const label =
      element.getAttribute('aria-label') ??
      element.textContent?.trim().slice(0, 40) ??
      element.tagName;
    return {
      id: element.dataset.tabStop,
      name: `${element.tagName.toLowerCase()}[${element.getAttribute('role') ?? element.getAttribute('type') ?? ''}] ${label}`,
      visible,
    };
  });

test.use({ locale: 'en-US' });
test.skip(({ isMobile }) => isMobile, 'keyboard use is tested on desktop');

test('the skip link is the first stop and moves focus to the content', async ({ page }) => {
  await openPage(page, PAGES[0]);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('#main-content')).toBeFocused();
});

for (const appPage of PAGES) {
  test(`${appPage.name}: every Tab stop shows focus`, async ({ page }) => {
    test.setTimeout(60_000);
    await openPage(page, appPage);
    const stops: Stop[] = [];
    for (let step = 0; step < STOPS; step += 1) {
      await page.keyboard.press('Tab');
      const stop = await focusedStop(page);
      if (!stop) break;
      stops.push(stop);
    }
    expect(stops.length, 'Tab reaches the page').toBeGreaterThan(3);
    expect(stops.filter((stop) => !stop.visible).map((stop) => stop.name)).toEqual([]);
    // No trap: focus moves on. A date-time input takes one Tab per segment (month, day, year,
    // hour, minute, AM/PM), so a few stops in a row on one element are fine.
    let run = 1;
    stops.forEach((stop, index) => {
      run = index > 0 && stop.id === stops[index - 1].id ? run + 1 : 1;
      expect(run, `focus stuck on ${stop.name}`).toBeLessThanOrEqual(MAX_STOPS_PER_ELEMENT);
    });
  });
}
