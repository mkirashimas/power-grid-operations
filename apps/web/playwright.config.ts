import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const REALTIME_PORT = 8191;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    // The realtime service, ticking 5× faster with frequent alarms so tests don't wait.
    {
      command: 'yarn workspace @pgo/realtime start',
      url: `http://localhost:${REALTIME_PORT}/healthz`,
      env: { PORT: String(REALTIME_PORT), TICK_MS: '200', ALARM_RATE: '0.1' },
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
    // Runs against the production build. CI builds in an earlier step; locally this builds first.
    {
      command: isCI
        ? `yarn start -p ${PORT}`
        : `yarn workspace @pgo/ui build:storybook && yarn build && yarn start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: { REALTIME_URL: `ws://localhost:${REALTIME_PORT}` },
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
  ],
});
