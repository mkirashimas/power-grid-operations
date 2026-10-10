import { describe, expect, it } from 'vitest';
import snapshot from '../data/ercot-snapshot.json' with { type: 'json' };
import { generateAssets } from './assets.ts';
import { defaultTelemetryWindow, generateTelemetry, periodToMs } from './telemetry.ts';
import type { EiaSnapshot } from './types.ts';

const demand = (snapshot as EiaSnapshot).series.find((series) => series.id === 'demand')!.points;
const assets = generateAssets();
const telemetry = generateTelemetry(assets, demand);

const correlation = (a: number[], b: number[]) => {
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const [ma, mb] = [mean(a), mean(b)];
  let cov = 0;
  let va = 0;
  let vb = 0;
  a.forEach((_, i) => {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  });
  return cov / Math.sqrt(va * vb);
};

describe('periodToMs', () => {
  it('reads EIA periods as UTC hours', () => {
    expect(periodToMs('2026-10-08T05')).toBe(Date.UTC(2026, 9, 8, 5));
  });
});

describe('generateTelemetry', () => {
  it('produces 1M+ rows: every asset at every 15-minute step', () => {
    expect(telemetry.steps).toBe(6 * 24 * 4);
    expect(telemetry.length).toBe(assets.length * telemetry.steps);
    expect(telemetry.length).toBeGreaterThan(1_000_000);
  });

  it('orders rows by asset, then time', () => {
    const { steps } = telemetry;
    const asset = assets[123];
    const first = asset.index * steps;
    expect(telemetry.assetIndex[first]).toBe(asset.index);
    expect(telemetry.assetIndex[first + steps - 1]).toBe(asset.index);
    expect(telemetry.timestamp[first + 1] - telemetry.timestamp[first]).toBe(15 * 60_000);
  });

  it('ends at the last demand hour', () => {
    const window = defaultTelemetryWindow(demand);
    const lastDemand = demand.findLast((point) => point.value !== null)!;
    expect(window.end).toBe(periodToMs(lastDemand.period) + 3_600_000);
  });

  it('is deterministic for a seed', () => {
    // Byte comparison: element-wise toEqual on 1M floats takes seconds.
    const sameBytes = (x: Float32Array, y: Float32Array) =>
      Buffer.from(x.buffer).equals(Buffer.from(y.buffer));
    expect(sameBytes(generateTelemetry(assets, demand).mw, telemetry.mw)).toBe(true);
    expect(sameBytes(generateTelemetry(assets, demand, undefined, 7).mw, telemetry.mw)).toBe(false);
  });

  it('keeps values in plausible ranges', () => {
    for (let row = 0; row < telemetry.length; row += 97) {
      expect(Number.isFinite(telemetry.mw[row])).toBe(true);
      expect(telemetry.loadingPct[row]).toBeGreaterThanOrEqual(0);
      expect(telemetry.loadingPct[row]).toBeLessThan(200);
      expect(telemetry.voltagePu[row]).toBeGreaterThanOrEqual(0.9);
      expect(telemetry.voltagePu[row]).toBeLessThanOrEqual(1.1);
    }
  });

  it('makes total load follow the real EIA demand shape', () => {
    const loads = assets.filter((asset) => asset.kind === 'load');
    const window = defaultTelemetryWindow(demand);
    const totals: number[] = [];
    const reference: number[] = [];
    // Compare on the hour, where the shape equals the EIA value exactly.
    for (let step = 0; step < telemetry.steps; step += 4) {
      totals.push(
        loads.reduce((sum, load) => sum + telemetry.mw[load.index * telemetry.steps + step], 0),
      );
      const t = window.start + step * 15 * 60_000;
      reference.push(demand.find((point) => periodToMs(point.period) === t)?.value ?? NaN);
    }
    const pairs = totals
      .map((total, i) => [total, reference[i]])
      .filter(([, r]) => !Number.isNaN(r));
    expect(
      correlation(
        pairs.map(([t]) => t),
        pairs.map(([, r]) => r),
      ),
    ).toBeGreaterThan(0.95);
  });
});
