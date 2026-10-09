import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { downsampleLttb } from './lttb.ts';
import { downsampleMinMax } from './minmax.ts';
import type { Algorithm } from './types.ts';
import { createWasmSeries, loadWasmSync, type WasmSeries } from './wasm.ts';

// A 1-second series over 3 days with noise and spikes, like the synthetic load on /charts.
const n = 3 * 86_400;
const start = Date.UTC(2026, 8, 1);
const time = Float64Array.from({ length: n }, (_, i) => start + i * 1000);
let seed = 42;
const random = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
  return seed / 2 ** 31;
};
const value = Float32Array.from(
  { length: n },
  (_, i) => 50_000 + Math.sin(i / 7000) * 8000 + random() * 300 + (random() < 0.0005 ? 4000 : 0),
);

const js = { minmax: downsampleMinMax, lttb: downsampleLttb } satisfies Record<Algorithm, unknown>;

describe('JS and WASM return identical points', () => {
  let wasm: WasmSeries;
  beforeAll(() => {
    loadWasmSync(readFileSync(new URL('../pkg/downsample_bg.wasm', import.meta.url)));
    wasm = createWasmSeries(time, value);
    return () => wasm.free();
  });

  const cases: [string, number, number, number][] = [
    ['the whole range', time[0], time[n - 1], 1200],
    ['one hour inside', start + 30 * 3_600_000, start + 31 * 3_600_000, 800],
    ['a range past both ends', start - 3_600_000, time[n - 1] + 3_600_000, 640],
    ['a range smaller than the buckets', start + 1000, start + 60_000, 500],
    ['an odd bucket count', start + 12_345_678, start + 98_765_432, 333],
  ];

  for (const algorithm of ['minmax', 'lttb'] as const) {
    it.each(cases)(`${algorithm}: %s`, (_, from, to, buckets) => {
      const expected = js[algorithm]({ time, value }, from, to, buckets);
      const actual = wasm.downsample(algorithm, from, to, buckets);
      expect(actual.inputCount).toBe(expected.inputCount);
      expect(actual.time).toEqual(expected.time);
      expect(actual.value).toEqual(expected.value);
    });
  }
});
