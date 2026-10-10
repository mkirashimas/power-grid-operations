import { generateAssets, generateTelemetry, type HourlyPoint } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { assetSeries } from './assetSeries';

const START = Date.UTC(2026, 9, 1);
const demand: HourlyPoint[] = Array.from({ length: 24 * 8 }, (_, i) => ({
  period: new Date(START + i * 3_600_000).toISOString().slice(0, 13),
  value: 50_000,
}));

describe('assetSeries', () => {
  const assets = generateAssets();
  const columns = generateTelemetry(assets, demand);

  it("returns every reading of one asset, in time order, and only that asset's", () => {
    const asset = assets[123];
    const series = assetSeries(columns, asset.index);
    expect(series.time).toHaveLength(columns.steps);
    const start = asset.index * columns.steps;
    for (let i = 0; i < columns.steps; i += 1) {
      expect(columns.assetIndex[start + i]).toBe(asset.index);
    }
    expect(series.mw[0]).toBe(columns.mw[start]);
    expect(series.loadingPct.at(-1)).toBe(columns.loadingPct[start + columns.steps - 1]);
    for (let i = 1; i < series.time.length; i += 1) {
      expect(series.time[i]).toBeGreaterThan(series.time[i - 1]);
    }
  });

  it('is empty for an index past the end', () => {
    expect(assetSeries(columns, assets.length + 5).time).toHaveLength(0);
  });
});
