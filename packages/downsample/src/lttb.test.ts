import { describe, expect, it } from 'vitest';
import { downsampleLttb } from './lttb.ts';

describe('downsampleLttb', () => {
  const n = 100_000;
  const time = Float64Array.from({ length: n }, (_, i) => i * 1000);
  const value = Float32Array.from({ length: n }, (_, i) => Math.sin(i / 5000) * 100);

  it('returns exactly `threshold` points, including the first and last', () => {
    const result = downsampleLttb({ time, value }, 0, time[n - 1], 300);
    expect(result.inputCount).toBe(n);
    expect(result.time).toHaveLength(300);
    expect(result.time[0]).toBe(time[0]);
    expect(result.time[299]).toBe(time[n - 1]);
    for (let i = 1; i < result.time.length; i += 1) {
      expect(result.time[i]).toBeGreaterThan(result.time[i - 1]);
    }
  });

  it('picks the point forming the largest triangle in each bucket', () => {
    // 3 buckets of 2 points between the fixed ends; the spike at index 3 wins its bucket.
    const result = downsampleLttb(
      { time: [0, 1, 2, 3, 4, 5, 6, 7], value: [0, 0, 1, 9, 1, 0, 0, 0] },
      0,
      7,
      5,
    );
    expect(Array.from(result.time)).toEqual([0, 2, 3, 5, 7]);
    expect(Array.from(result.value)).toEqual([0, 1, 9, 0, 0]);
  });

  it('copies small inputs and tiny thresholds through unchanged', () => {
    expect(downsampleLttb({ time: [0, 1, 2], value: [5, 6, 7] }, 0, 2, 100).value).toEqual(
      Float64Array.from([5, 6, 7]),
    );
    expect(downsampleLttb({ time, value }, 0, time[9], 2).time).toHaveLength(10);
  });
});
