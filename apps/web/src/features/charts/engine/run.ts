import {
  ALGORITHMS,
  downsampleLttb,
  downsampleMinMax,
  type Algorithm,
  type DownsampleResult,
  type Engine,
} from '@pgo/downsample';
import type { WasmSeries } from '@pgo/downsample/wasm';

/** The series the worker downsamples, plus its copy in WASM memory (null if WASM failed). */
export interface DownsampleStore {
  time: Float64Array;
  value: Float32Array;
  wasm: WasmSeries | null;
}

export interface DownsampleRequest {
  engine: Engine;
  algorithm: Algorithm;
  from: number;
  to: number;
  buckets: number;
}

export interface DownsampleAnswer extends DownsampleResult {
  /** The engine that ran: JS when WASM was asked for but is unavailable. */
  engine: Engine;
  ms: number;
}

const JS = { minmax: downsampleMinMax, lttb: downsampleLttb } satisfies Record<Algorithm, unknown>;

/** Runs one downsample request with the requested engine and algorithm, and times it. */
export const runDownsample = (
  store: DownsampleStore,
  { engine, algorithm, from, to, buckets }: DownsampleRequest,
): DownsampleAnswer => {
  const started = performance.now();
  if (engine === 'wasm' && store.wasm) {
    const result = store.wasm.downsample(algorithm, from, to, buckets);
    return { ...result, engine: 'wasm', ms: performance.now() - started };
  }
  const result = JS[algorithm](store, from, to, buckets);
  return { ...result, engine: 'js', ms: performance.now() - started };
};

const DAY = 24 * 3_600_000;
export const BENCHMARK_RANGES = [
  { key: 'day', span: DAY },
  { key: 'week', span: 7 * DAY },
  { key: 'month', span: 30 * DAY },
] as const;
export type BenchmarkRange = (typeof BENCHMARK_RANGES)[number]['key'];

export interface BenchmarkRow {
  range: BenchmarkRange;
  engine: Engine;
  algorithm: Algorithm;
  inputPoints: number;
  outputPoints: number;
  medianMs: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Times every engine × algorithm over the last day, week and month of the series: one warm-up
 * run, then the median of `runs`. WASM rows are left out when WASM is unavailable.
 */
export const runBenchmark = (store: DownsampleStore, buckets: number, runs = 7): BenchmarkRow[] => {
  const end = store.time[store.time.length - 1] ?? 0;
  const engines: Engine[] = store.wasm ? ['js', 'wasm'] : ['js'];
  return BENCHMARK_RANGES.flatMap(({ key, span }) =>
    ALGORITHMS.flatMap((algorithm) =>
      engines.map((engine) => {
        const request = { engine, algorithm, from: end - span, to: end, buckets };
        const warmUp = runDownsample(store, request);
        const times = Array.from({ length: runs }, () => runDownsample(store, request).ms);
        return {
          range: key,
          engine,
          algorithm,
          inputPoints: warmUp.inputCount,
          outputPoints: warmUp.time.length,
          medianMs: median(times),
        };
      }),
    ),
  );
};
