import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The demo tour: about 90 seconds through every module, recorded as a video, with captions.
// Screenshots for the README are taken on the way. Run with `yarn demo:record`.

const VIDEO = new URL('../../../demo/power-grid-operations.webm', import.meta.url);
const SHOTS = new URL('../../../docs/screenshots/', import.meta.url);

/** A caption box over the page, only in the recording (it is not part of the app). */
const caption = async (page: Page, text: string, holdMs = 2000) => {
  await page.evaluate((value) => {
    let box = document.getElementById('demo-caption');
    if (!box) {
      box = document.createElement('div');
      box.id = 'demo-caption';
      box.setAttribute('aria-hidden', 'true');
      Object.assign(box.style, {
        position: 'fixed',
        left: '50%',
        bottom: '24px',
        transform: 'translateX(-50%)',
        zIndex: '99999',
        maxWidth: '900px',
        padding: '10px 18px',
        borderRadius: '8px',
        background: 'rgba(17, 24, 39, 0.88)',
        color: '#fff',
        font: '500 18px/1.4 Roboto, system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        pointerEvents: 'none',
      });
      document.body.append(box);
    }
    box.textContent = value;
  }, text);
  await page.waitForTimeout(holdMs);
};

const hideCaption = (page: Page) =>
  page.evaluate(() => document.getElementById('demo-caption')?.remove());

/** A README screenshot, without the caption. */
const shot = async (page: Page, name: string) => {
  await hideCaption(page);
  await page.screenshot({
    path: fileURLToPath(new URL(`${name}.jpg`, SHOTS)),
    type: 'jpeg',
    quality: 82,
  });
};

const go = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

test('demo tour', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });

  // Overview
  await go(page, '/');
  await caption(
    page,
    'Power Grid Operations: a console for the Texas (ERCOT) grid, on real EIA data and a synthetic grid',
    3000,
  );
  await shot(page, 'overview');

  // Telemetry
  await go(page, '/telemetry');
  await expect(page.getByTestId('telemetry-readout')).toContainText('rows', { timeout: 30_000 });
  await caption(page, 'Telemetry: 1,076,544 rows, generated and queried in a Web Worker');
  await page.getByRole('columnheader', { name: 'MW' }).click();
  await caption(page, 'Sorting a million rows off the main thread');
  await page.getByRole('combobox', { name: 'Group by' }).click();
  await page.getByRole('option', { name: 'Zone' }).click();
  await caption(page, 'Grouping by weather zone, with keyboard support for the whole grid');
  await shot(page, 'telemetry');

  // Charts
  await go(page, '/charts');
  await expect(page.getByTestId('highres-stats')).toBeVisible({ timeout: 30_000 });
  await caption(page, 'Chart workbench: synced panes, zoom, brush and crosshair');
  await page.getByRole('button', { name: '7 d' }).first().click();
  await caption(
    page,
    'A 2.6M-point series, downsampled in Rust/WebAssembly in a worker, with a JS vs WASM benchmark',
    3000,
  );
  await shot(page, 'charts');

  // Alarms
  await go(page, '/alarms');
  await expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'live', {
    timeout: 30_000,
  });
  await caption(page, 'Live alarms over a WebSocket from a second Cloud Run service', 3000);
  await shot(page, 'alarms');
  const ack = page
    .getByRole('grid', { name: 'Alarms' })
    .getByRole('button', { name: /^Acknowledge alarm/ });
  if (await ack.first().isVisible()) {
    await ack.first().click();
    await caption(page, 'Acknowledgements are shared with every open tab');
  }

  // Map
  await go(page, '/map?asset=sub-cst-001');
  await expect(page.getByTestId('asset-map')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await caption(
    page,
    'Live map: assets coloured by loading, updated with every tick of the feed',
    3000,
  );
  await shot(page, 'map');

  // Network
  await go(page, '/network?asset=ln-0001');
  await expect(
    page.getByTestId('topology-graph').locator('.react-flow__node').first(),
  ).toBeVisible();
  await caption(page, 'Network: asset tree and topology of 400 substations and 769 lines');
  await page.getByRole('button', { name: 'Trip line' }).click();
  await expect(page.getByTestId('study-results')).toBeVisible();
  await caption(page, 'What-if: a DC power flow re-solves the grid in a few milliseconds', 3000);
  await shot(page, 'network');
  await page.getByRole('button', { name: 'About this section' }).click();
  const help = page.getByRole('complementary', { name: 'About Network' });
  await help.getByRole('heading', { name: 'Under the hood' }).scrollIntoViewIfNeeded();
  await caption(page, 'Every section explains itself: plain language, plus “Under the hood”');
  await shot(page, 'help');
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();

  // Incidents
  await go(page, '/incidents/inc-sample-01?doc=att-sample-relay');
  await expect(page.locator('[data-page-number="1"]')).toHaveAttribute('data-rendered', 'true');
  await caption(page, 'Incident reports: rich text with asset mentions, and a PDF viewer');
  await shot(page, 'incidents');
  await page.getByRole('searchbox', { name: 'Find in document' }).fill('breaker');
  await caption(page, 'pdf.js with a text layer: search, select, and read with a screen reader');
  const editor = page.getByRole('textbox', { name: 'Report text' });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(' See also @cst-030', { delay: 60 });
  await page.keyboard.press('Enter');
  await caption(page, 'Type @ to link any grid asset; reports are saved in the browser');

  // Theme and language
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await caption(page, 'Light and dark themes from one CSS-variable theme');
  await go(page, '/charts');
  await expect(page.getByTestId('highres-stats')).toBeVisible({ timeout: 30_000 });
  await shot(page, 'charts-dark');
  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'Español' }).click();
  await caption(page, 'Five languages, rendered on the server without a flash', 3000);
  await caption(
    page,
    'Accessible (WCAG 2.1 AA, checked by axe in CI), tested, and open source',
    3000,
  );

  // Save the video once the page is closed.
  await page.close();
  await page.video()?.saveAs(fileURLToPath(VIDEO));
});

// The install dialog's screenshots (manifest `screenshots`, src/app/manifest.ts): the overview
// on a desktop and on a phone. The manifest states their sizes, so keep them in step.
const INSTALL_SHOTS = new URL('../public/screenshots/', import.meta.url);

test('install screenshots', async ({ page }) => {
  mkdirSync(INSTALL_SHOTS, { recursive: true });
  const overview = async () => {
    await go(page, '/');
    await expect(page.getByText(/\d MW/).first()).toBeVisible({ timeout: 30_000 });
  };

  await overview();
  await page.screenshot({ path: fileURLToPath(new URL('wide.png', INSTALL_SHOTS)) });

  await page.setViewportSize({ width: 390, height: 844 });
  await overview();
  await page.screenshot({ path: fileURLToPath(new URL('narrow.png', INSTALL_SHOTS)) });
});
