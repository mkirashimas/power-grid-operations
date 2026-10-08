import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Runs axe (WCAG 2.1 AA, including colour contrast) on every story of the published
// Storybook, in both colour schemes. Needs `yarn build:storybook` before the web build.

interface StoryIndex {
  entries: Record<string, { id: string; type: 'story' | 'docs'; title: string; name: string }>;
}

// Storybook's a11y addon runs axe in the same frame when a story loads; wait for it to finish.
const analyze = async (page: Page) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await new AxeBuilder({ page })
        .include('#storybook-root')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    } catch (error) {
      if (attempt >= 20 || !String(error).includes('Axe is already running')) throw error;
      await page.waitForTimeout(250);
    }
  }
};

test.describe('design system accessibility', () => {
  // Story pages are viewport-independent; one project is enough.
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('every story passes axe in light and dark mode', async ({ page, request }) => {
    test.setTimeout(180_000);
    const index = (await (await request.get('/storybook/index.json')).json()) as StoryIndex;
    const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');
    expect(stories.length).toBeGreaterThan(10);

    const failures: string[] = [];
    for (const story of stories) {
      for (const theme of ['light', 'dark']) {
        await page.goto(
          `/storybook/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
        );
        await page.locator('#storybook-root').waitFor();
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        const results = await analyze(page);
        results.violations.forEach((violation) =>
          violation.nodes.forEach((node) => {
            const detail = (node.failureSummary ?? '').split('\n').slice(1).join(' ').trim();
            failures.push(
              `${story.title} / ${story.name} (${theme}): ${violation.id} at ${node.target.join(' ')}: ${detail}`,
            );
          }),
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
