import { downsampleLttb, downsampleMinMax } from '@pgo/downsample';
import type { WasmSeries } from '@pgo/downsample/wasm';
import { describe, expect, it, vi } from 'vitest';
import { runBenchmark, runDownsample, type DownsampleStore } from './run';

const DAY = 24 * 3_600_000;
const START = Date.UTC(2026, 8, 1);
// 31 days at one point per minute.
const n = 31 * 24 * 60;
const time = Float64Array.from({ length: n }, (_, i) => START + i * 60_000);
const value = Float32Array.from({ length: n }, (_, i) => 50_000 + 5000 * Math.sin(i / 300));

// Stands in for the WASM series; the package's parity test checks the real one.
const fakeWasm = (): WasmSeries => ({
  downsample: vi.fn((algorithm, from, to, buckets) =>
    (algorithm === 'lttb' ? downsampleLttb : downsampleMinMax)({ time, value }, from, to, buckets),
  ),
  free: vi.fn(),
});

const request = { from: START, to: START + DAY, buckets: 400 } as const;

describe('runDownsample', () => {
  it('runs the requested JS algorithm', () => {
    const store: DownsampleStore = { time, value, wasm: fakeWasm() };
    const minmax = runDownsample(store, { ...request, engine: 'js', algorithm: 'minmax' });
    const lttb = runDownsample(store, { ...request, engine: 'js', algorithm: 'lttb' });

    expect(minmax.engine).toBe('js');
    expect(minmax.time).toEqual(downsampleMinMax(store, START, START + DAY, 400).time);
    expect(lttb.time).toHaveLength(400);
    expect(store.wasm!.downsample).not.toHaveBeenCalled();
    expect(lttb.ms).toBeGreaterThanOrEqual(0);
  });

  it('runs WASM when asked, and falls back to JS when it is unavailable', () => {
    const wasm = fakeWasm();
    const answer = runDownsample(
      { time, value, wasm },
      { ...request, engine: 'wasm', algorithm: 'lttb' },
    );
    expect(answer.engine).toBe('wasm');
    expect(wasm.downsample).toHaveBeenCalledWith('lttb', START, START + DAY, 400);

    const fallback = runDownsample(
      { time, value, wasm: null },
      { ...request, engine: 'wasm', algorithm: 'minmax' },
    );
    expect(fallback.engine).toBe('js');
    expect(fallback.time.length).toBeGreaterThan(0);
  });
});

describe('runBenchmark', () => {
  it('times every range, algorithm and engine', () => {
    const rows = runBenchmark({ time, value, wasm: fakeWasm() }, 300, 3);
    expect(rows).toHaveLength(3 * 2 * 2);
    const day = rows.find((r) => r.range === 'day' && r.algorithm === 'lttb' && r.engine === 'js');
    // 1,441 points inside the last 24 h, plus the one before it.
    expect(day).toMatchObject({ inputPoints: 24 * 60 + 2, outputPoints: 300 });
    expect(rows.every((row) => row.medianMs >= 0)).toBe(true);
  });

  it('leaves out WASM rows when WASM is unavailable', () => {
    const rows = runBenchmark({ time, value, wasm: null }, 300, 1);
    expect(rows).toHaveLength(3 * 2);
    expect(rows.every((row) => row.engine === 'js')).toBe(true);
  });
});
