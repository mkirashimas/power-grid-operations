import { expect, type Page } from '@playwright/test';

// Every page of the app, and how to tell it has finished loading. Used by the accessibility
// sweep (a11y-sweep.spec.ts, keyboard.spec.ts).

// The map's base style comes from OpenFreeMap; tests use an empty local style instead.
const EMPTY_STYLE = {
  version: 8,
  sources: {
    base: {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © OpenMapTiles',
    },
  },
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8eaed' } }],
};

export const routeTiles = (page: Page) =>
  page.route('https://tiles.openfreemap.org/**', (route) =>
    route.request().url().includes('/styles/')
      ? route.fulfill({ json: EMPTY_STYLE })
      : route.abort(),
  );

export interface AppPage {
  name: string;
  path: string;
  ready: (page: Page) => Promise<void>;
}

const heading = (page: Page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible();

export const PAGES: AppPage[] = [
  { name: 'overview', path: '/', ready: heading },
  {
    name: 'telemetry',
    path: '/telemetry',
    ready: (page) =>
      expect(page.getByTestId('telemetry-readout')).toContainText('rows', { timeout: 30_000 }),
  },
  {
    name: 'charts',
    path: '/charts',
    ready: (page) => expect(page.getByTestId('highres-stats')).toBeVisible({ timeout: 30_000 }),
  },
  {
    name: 'alarms',
    path: '/alarms',
    ready: (page) =>
      expect(page.getByTestId('connection-status')).toHaveAttribute('data-state', 'live', {
        timeout: 30_000,
      }),
  },
  {
    name: 'map',
    path: '/map',
    ready: (page) =>
      expect(page.getByTestId('asset-map')).toHaveAttribute('data-ready', 'true', {
        timeout: 30_000,
      }),
  },
  {
    name: 'network',
    path: '/network',
    ready: (page) =>
      expect(page.getByTestId('topology-graph').locator('.react-flow__node').first()).toBeVisible(),
  },
  {
    name: 'incidents',
    path: '/incidents',
    ready: (page) => expect(page.getByRole('table', { name: 'Incident reports' })).toBeVisible(),
  },
  {
    name: 'incident report',
    path: '/incidents/inc-sample-01?doc=att-sample-relay',
    ready: (page) =>
      expect(page.locator('[data-page-number="1"]')).toHaveAttribute('data-rendered', 'true'),
  },
  { name: 'not found', path: '/no-such-page', ready: heading },
];

export const openPage = async (page: Page, { path, ready }: AppPage) => {
  await routeTiles(page);
  await page.goto(path);
  await ready(page);
};
