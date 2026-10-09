import init, { initSync, SeriesStore, type InitInput } from '../pkg/downsample.js';
import type { Algorithm, DownsampleResult } from './types.ts';

/** A series held in WASM memory; each call only passes the range. Call `free()` when done. */
export interface WasmSeries {
  downsample: (algorithm: Algorithm, from: number, to: number, buckets: number) => DownsampleResult;
  free: () => void;
}

/**
 * Loads the WASM module (by default `pkg/downsample_bg.wasm`, resolved by the bundler).
 * Resolves to false instead of throwing, so callers can fall back to JS.
 */
export const loadWasm = async (input?: InitInput): Promise<boolean> => {
  try {
    await init(input === undefined ? undefined : { module_or_path: input });
    return true;
  } catch {
    return false;
  }
};

/** Loads the module synchronously from its bytes, e.g. in Node tests. */
export const loadWasmSync = (bytes: BufferSource) => {
  initSync({ module: bytes });
};

/** Copies the series into WASM memory once. The module must be loaded first. */
export const createWasmSeries = (time: Float64Array, value: Float32Array): WasmSeries => {
  const store = new SeriesStore(time, value);
  return {
    downsample: (algorithm, from, to, buckets) => {
      const whole = Math.floor(buckets);
      const interleaved =
        algorithm === 'lttb' ? store.lttb(from, to, whole) : store.minMax(from, to, whole);
      const count = interleaved.length / 2;
      const outTime = new Float64Array(count);
      const outValue = new Float64Array(count);
      for (let i = 0; i < count; i += 1) {
        outTime[i] = interleaved[2 * i];
        outValue[i] = interleaved[2 * i + 1];
      }
      return { time: outTime, value: outValue, inputCount: store.countInRange(from, to) };
    },
    free: () => store.free(),
  };
};
