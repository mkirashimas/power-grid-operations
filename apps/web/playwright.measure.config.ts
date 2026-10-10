import { defineConfig, devices } from '@playwright/test';

// `yarn measure`: the README's performance numbers, from the production build in desktop
// Chromium. Unlike the e2e config, the realtime service runs at its normal pace (1 tick a
// second), so the numbers match what a visitor sees.
const PORT = 3200;
const REALTIME_PORT = 8291;

export default defineConfig({
  testDir: './measure',
  // One page at a time, so runs don't compete for the CPU.
  workers: 1,
  reporter: 'list',
  timeout: 300_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    // Measure the network loads, without the service worker's precache downloads competing.
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: 'yarn workspace @pgo/realtime start',
      url: `http://localhost:${REALTIME_PORT}/healthz`,
      env: { PORT: String(REALTIME_PORT) },
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
