import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';

// Playwright starts the realtime service with TICK_MS=200 and frequent alarms (playwright.config.ts).

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const connection = (page: Page) => page.getByTestId('connection-status');
const alarmGrid = (page: Page) => page.getByRole('grid', { name: 'Alarms' });
const ackButtons = (page: Page) =>
  alarmGrid(page).getByRole('button', { name: /^Acknowledge alarm/ });

const openAlarms = async (page: Page, search = '') => {
  await page.goto(`/alarms${search}`);
  await expect(connection(page)).toHaveAttribute('data-state', 'live', { timeout: 30_000 });
};

test.use({ locale: 'en-US' });

test('streams live load, KPIs and alarms', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openAlarms(page);

  // The visible chip, followed by the hidden status for screen readers.
  await expect(connection(page)).toContainText(/^Live · \d+ ms/);
  await expect(page.getByText('Synthetic').first()).toBeVisible();
  await expect(
    page.getByRole('img', { name: /^System load, .* to .*: System load from/ }),
  ).toBeVisible();
  // Five ticks a second, plus alarm messages.
  await expect(page.getByTestId('alarm-kpis')).toContainText(/Updates per second\s*[4-9]/, {
    timeout: 15_000,
  });
  await expect(ackButtons(page).first()).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expectNoAxeViolations(page);
});

test('an acknowledgement in one tab shows in another', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await openAlarms(first);
  await openAlarms(second);

  // Freeze both tables so rows keep their place while new alarms arrive.
  await expect(ackButtons(second).first()).toBeVisible({ timeout: 15_000 });
  await second.getByRole('button', { name: 'Pause' }).click();
  const label = (await ackButtons(second).first().getAttribute('aria-label'))!;
  await first.getByRole('button', { name: 'Pause' }).click();

  await first.getByRole('button', { name: label, exact: true }).click();
  await expect(second.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  await expect(first.getByRole('button', { name: label, exact: true })).toHaveCount(0);
});

test('acknowledges from the keyboard inside the grid', async ({ page }) => {
  test.setTimeout(60_000);
  await openAlarms(page);

  // Other tests acknowledge alarms on the same server at the same time, so an attempt can lose
  // its target; it then starts again from a fresh, unpaused table.
  await expect(async () => {
    const resume = page.getByRole('button', { name: 'Resume' });
    if (await resume.isVisible()) await resume.click();
    await expect(ackButtons(page).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    const button = ackButtons(page).first();
    const label = (await button.getAttribute('aria-label', { timeout: 1000 }))!;

    // The first button is not always in the first row: arrow down to its row, then End to
    // its cell, and press Enter there.
    const rowIndex = await button
      .locator('xpath=ancestor::*[@role="row"]')
      .getAttribute('aria-rowindex', { timeout: 1000 });
    const row = Number(rowIndex) - 2;
    await alarmGrid(page).getByRole('columnheader').first().focus();
    for (let i = 0; i <= row; i += 1) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await expect(page.locator(':focus')).toHaveAttribute('data-cell', `${row}:7`, {
      timeout: 2000,
    });
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0, {
      timeout: 3000,
    });
  }).toPass({ timeout: 45_000 });
});

test('filters by severity and zone, kept in the URL', async ({ page }) => {
  await openAlarms(page);
  await page.getByRole('combobox', { name: 'Severity' }).click();
  await page.getByRole('option', { name: 'Alarms' }).click();
  await expect(page).toHaveURL(/severity=alarm/);

  await page.getByRole('combobox', { name: 'Zone' }).click();
  await page.getByRole('option', { name: 'Coast' }).click();
  await expect(page).toHaveURL(/severity=alarm&zone=coast/);

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Severity' })).toHaveText('Alarms');
  await expect(page.getByRole('combobox', { name: 'Zone' })).toHaveText('Coast');
  // Every listed row is a coast alarm.
  const rows = alarmGrid(page).getByRole('row');
  await expect(async () => {
    const count = await rows.count();
    for (let i = 1; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText(/Alarm.*Coast/);
    }
  }).toPass({ timeout: 15_000 });
});

test('shows Reconnecting… when the connection drops, then recovers', async ({ page }) => {
  let firstSocket: WebSocketRoute | undefined;
  await page.routeWebSocket(/:8191/, (socket) => {
    socket.connectToServer();
    firstSocket ??= socket;
  });
  await openAlarms(page);

  await firstSocket!.close();
  await expect(connection(page)).toHaveAttribute('data-state', 'reconnecting');
  await expect(connection(page)).toHaveAttribute('data-state', 'live', { timeout: 10_000 });
});

test('has no horizontal page scroll on narrow screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await openAlarms(page);
  await expect(ackButtons(page).first()).toBeAttached({ timeout: 15_000 });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
