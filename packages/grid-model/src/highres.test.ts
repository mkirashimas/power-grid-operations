import { describe, expect, it } from 'vitest';
import snapshot from '../data/ercot-snapshot.json' with { type: 'json' };
import { generateHighResLoad } from './highres.ts';
import { periodToMs } from './telemetry.ts';
import type { EiaSnapshot } from './types.ts';

const demand = (snapshot as EiaSnapshot).series.find((series) => series.id === 'demand')!.points;
const known = demand.filter((point) => point.value !== null);

describe('generateHighResLoad', () => {
  const series = generateHighResLoad(demand);

  it('covers the demand span at 1-second resolution (millions of points)', () => {
    const span = (periodToMs(known.at(-1)!.period) - periodToMs(known[0].period)) / 1000;
    expect(series.time).toHaveLength(span + 1);
    expect(series.time.length).toBeGreaterThan(2_000_000);
    expect(series.time[1] - series.time[0]).toBe(1000);
  });

  it('follows the hourly demand within a few percent on the hour', () => {
    const start = series.time[0];
    known.slice(0, 48).forEach((point) => {
      const i = (periodToMs(point.period) - start) / 1000;
      expect(Math.abs(series.value[i] - point.value!) / point.value!).toBeLessThan(0.08);
    });
  });

  it('is deterministic for a seed', () => {
    const sample = (s: typeof series) => Array.from(s.value.subarray(0, 5000));
    expect(sample(generateHighResLoad(demand))).toEqual(sample(series));
    expect(sample(generateHighResLoad(demand, { seed: 3 }))).not.toEqual(sample(series));
  });

  it('supports coarser steps', () => {
    const minutes = generateHighResLoad(demand, { stepSeconds: 60 });
    expect(minutes.time.length).toBe(Math.floor((series.time.length - 1) / 60) + 1);
  });
});
