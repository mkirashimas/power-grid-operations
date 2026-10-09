import type { HourlyPoint } from '@pgo/grid-model';
import type { BenchmarkRow, DownsampleAnswer, DownsampleRequest } from '../engine/run';

/** Messages from the page to the downsampling worker. */
export type WorkerRequest =
  | { type: 'init'; demand: HourlyPoint[] }
  | { type: 'downsample'; id: number; request: DownsampleRequest }
  | { type: 'benchmark'; id: number; buckets: number };

/** Messages from the downsampling worker to the page. */
export type WorkerResponse =
  | {
      type: 'ready';
      /** A copy of the 1-second series for the crosshair readout and the table view. */
      time: Float64Array;
      value: Float32Array;
      generateMs: number;
      /** False when the WASM module failed to load; JS is used instead. */
      wasm: boolean;
    }
  | { type: 'result'; id: number; answer: DownsampleAnswer }
  | { type: 'benchmark'; id: number; rows: BenchmarkRow[] }
  | { type: 'error'; id?: number; message: string };
