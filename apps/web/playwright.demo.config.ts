import { defineConfig, devices } from '@playwright/test';

// `yarn demo:record`: a scripted tour of the production build, recorded as a video, plus the
// README screenshots. Not part of `yarn e2e`.
const PORT = 3300;
const REALTIME_PORT = 8391;
const SIZE = { width: 1440, height: 900 };

export default defineConfig({
  testDir: './e2e-demo',
  workers: 1,
  reporter: 'list',
  timeout: 600_000,
  outputDir: './test-results/demo',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    viewport: SIZE,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    video: { mode: 'on', size: SIZE },
  },
  webServer: [
    {
      command: 'yarn workspace @pgo/realtime start',
      url: `http://localhost:${REALTIME_PORT}/healthz`,
      // 4× speed and more disturbances than normal, so the alarm feed and the load history have
      // something to show within the 90 seconds of the tour.
      env: { PORT: String(REALTIME_PORT), TICK_MS: '250', ALARM_RATE: '0.3' },
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `yarn build && yarn start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: { REALTIME_URL: `ws://localhost:${REALTIME_PORT}` },
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
});
