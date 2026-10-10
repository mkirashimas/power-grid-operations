import { describe, expect, it } from 'vitest';
import { lowerBound } from './lowerBound.ts';
import { downsampleMinMax } from './minmax.ts';

const extent = (values: ArrayLike<number>) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }
  return [min, max];
};

describe('lowerBound', () => {
  it('finds the first time at or after t', () => {
    const time = [0, 10, 20, 30];
    expect(lowerBound(time, 15)).toBe(2);
    expect(lowerBound(time, 20)).toBe(2);
    expect(lowerBound(time, 40)).toBe(4);
    expect(lowerBound(time, -1)).toBe(0);
  });
});

describe('downsampleMinMax', () => {
  const n = 1_000_000;
  const time = Float64Array.from({ length: n }, (_, i) => i * 1000);
  const value = Float32Array.from(
    { length: n },
    (_, i) => Math.sin(i / 5000) * 100 + (i === 543_210 ? 900 : 0),
  );

  it('reduces a million points to at most 4 per bucket, keeping the extremes', () => {
    const result = downsampleMinMax({ time, value }, 0, time[n - 1], 500);

    expect(result.inputCount).toBe(n);
    expect(result.time.length).toBeLessThanOrEqual(500 * 4 + 2);
    const [min, max] = extent(value);
    expect(extent(result.value)[0]).toBeCloseTo(min, 3);
    expect(extent(result.value)[1]).toBeCloseTo(max, 3);
    for (let i = 1; i < result.time.length; i += 1) {
      expect(result.time[i]).toBeGreaterThanOrEqual(result.time[i - 1]);
    }
  });

  it('only looks at the requested range (plus one point either side)', () => {
    const from = time[1000];
    const to = time[2000];
    const result = downsampleMinMax({ time, value }, from, to, 2000);
    expect(result.inputCount).toBe(1002);
    expect(result.time[0]).toBe(time[999]);
    expect(result.time[result.time.length - 1]).toBe(time[2000]);
  });

  it('copies small inputs through unchanged', () => {
    const result = downsampleMinMax({ time: [0, 1, 2], value: [5, 6, 7] }, 0, 2, 100);
    expect(Array.from(result.value)).toEqual([5, 6, 7]);
  });

  it('returns nothing for an empty series', () => {
    expect(downsampleMinMax({ time: [], value: [] }, 0, 1, 10).time).toHaveLength(0);
  });
});
