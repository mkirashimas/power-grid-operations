import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openPage, PAGES } from '../e2e/support/pages';

// Measures every page and a few interactions, takes the median of RUNS, prints Markdown tables
// for the README and writes docs/measurements.json.

const RUNS = 5;
const SETTLE_MS = 2_000;
const OUT = new URL('../../../docs/measurements.json', import.meta.url);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Starts the observers before any page script runs. */
const observe = (page: Page) =>
  page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0, tbt: 0 };
    (window as unknown as { __metrics: typeof metrics }).__metrics = metrics;
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => (metrics.lcp = entry.startTime));
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) metrics.cls += shift.value;
      });
    }).observe({ type: 'layout-shift', buffered: true });
    // Total blocking time: the part of each long task over 50 ms.
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => (metrics.tbt += Math.max(0, entry.duration - 50)));
    }).observe({ type: 'longtask', buffered: true });
  });

interface PageResult {
  page: string;
  ready: number;
  lcp: number;
  cls: number;
  tbt: number;
  jsKb: number;
}

const results: { pages: PageResult[]; interactions: Record<string, number> } = {
  pages: [],
  interactions: {},
};

test('page load', async ({ browser }) => {
  for (const appPage of PAGES.filter(({ name }) => name !== 'not found')) {
    const runs: Omit<PageResult, 'page'>[] = [];
    for (let run = 0; run < RUNS; run += 1) {
      // A new context per run: a cold cache, like a first visit.
      const context = await browser.newContext();
      const page = await context.newPage();
      await observe(page);
      await openPage(page, appPage);
      const readyAt = await page.evaluate(() => performance.now());
      // Let late layout shifts and long tasks land.
      await page.waitForTimeout(500);
      runs.push(
        await page.evaluate((ready) => {
          const { lcp, cls, tbt } = (
            window as unknown as { __metrics: { lcp: number; cls: number; tbt: number } }
          ).__metrics;
          const js = performance
            .getEntriesByType('resource')
            .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'script')
            .reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0);
          return { ready, lcp, cls, tbt, jsKb: js / 1024 };
        }, readyAt),
      );
      await context.close();
    }
    results.pages.push({
      page: appPage.path.split('?')[0],
      ready: median(runs.map((r) => r.ready)),
      lcp: median(runs.map((r) => r.lcp)),
      cls: median(runs.map((r) => r.cls)),
      tbt: median(runs.map((r) => r.tbt)),
      jsKb: median(runs.map((r) => r.jsKb)),
    });
  }
});

/** Runs `action` RUNS times on fresh pages and records the median time to `done`. */
const timeInteraction = async (
  name: string,
  browser: import('@playwright/test').Browser,
  setup: (page: Page) => Promise<void>,
  action: (page: Page) => Promise<void>,
  done: (page: Page) => Promise<void>,
) => {
  const times: number[] = [];
  for (let run = 0; run < RUNS; run += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await setup(page);
    // Let the page finish loading (e.g. the live feed's first snapshot) before timing.
    await page.waitForTimeout(SETTLE_MS);
    const started = Date.now();
    await action(page);
    await done(page);
    times.push(Date.now() - started);
    await context.close();
  }
  results.interactions[name] = median(times);
};

const page = (name: string) => PAGES.find((appPage) => appPage.name === name)!;

test('interactions', async ({ browser }) => {
  await timeInteraction(
    'network: trip a line → button responds',
    browser,
    (p) => openPage(p, { ...page('network'), path: '/network?asset=ln-0001' }),
    (p) => p.getByRole('button', { name: 'Trip line' }).click(),
    (p) => expect(p.getByRole('button', { name: 'Restore line' })).toBeVisible(),
  );
  await timeInteraction(
    'network: trip a line → study results',
    browser,
    (p) => openPage(p, { ...page('network'), path: '/network?asset=ln-0001' }),
    (p) => p.getByRole('button', { name: 'Trip line' }).click(),
    (p) => expect(p.getByTestId('study-results').getByRole('row').nth(1)).toBeVisible(),
  );
  await timeInteraction(
    'incidents: open a PDF → first page drawn',
    browser,
    (p) =>
      openPage(p, {
        ...page('incident report'),
        path: '/incidents/inc-sample-01',
        ready: (q) => expect(q.getByRole('textbox', { name: 'Report text' })).toBeVisible(),
      }),
    (p) => p.getByRole('button', { name: /^relay-event-record\.pdf/ }).click(),
    (p) => expect(p.locator('[data-page-number="1"]')).toHaveAttribute('data-rendered', 'true'),
  );
  await timeInteraction(
    'telemetry: filter 1,076,544 rows by zone',
    browser,
    (p) => openPage(p, page('telemetry')),
    async (p) => {
      await p.getByRole('combobox', { name: 'Zone' }).click();
      await p.getByRole('option', { name: 'Coast' }).click();
    },
    (p) =>
      expect(p)
        .toHaveURL(/zone=coast/)
        .then(() => expect(p.getByTestId('telemetry-readout')).not.toContainText('Updating')),
  );
});

test.afterAll(() => {
  writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`);
  const ms = (value: number) => `${Math.round(value).toLocaleString('en-US')} ms`;
  const lines = [
    '| Page | Ready | LCP | CLS | TBT | JS (compressed) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...results.pages.map(
      (r) =>
        `| \`${r.page}\` | ${ms(r.ready)} | ${ms(r.lcp)} | ${r.cls.toFixed(3)} | ${ms(r.tbt)} | ${Math.round(r.jsKb)} kB |`,
    ),
    '',
    '| Interaction | Median |',
    '| --- | --- |',
    ...Object.entries(results.interactions).map(([name, value]) => `| ${name} | ${ms(value)} |`),
  ];
  console.log(`\n${lines.join('\n')}\n`);
});
