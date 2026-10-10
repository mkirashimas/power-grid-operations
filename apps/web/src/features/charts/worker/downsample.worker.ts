// Generates the 1-second series and downsamples it (JS or Rust/WASM) off the main thread.
import { generateHighResLoad } from '@pgo/grid-model';
import { createWasmSeries, loadWasm } from '@pgo/downsample/wasm';
import { runBenchmark, runDownsample, type DownsampleStore } from '../engine/run';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Minimal worker scope typing; the app's tsconfig uses the DOM lib, not WebWorker.
const scope = self as unknown as {
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let store: DownsampleStore | undefined;

const requireStore = () => {
  if (!store) throw new Error('The downsampling worker received a request before init');
  return store;
};

const handle = async (request: WorkerRequest) => {
  if (request.type === 'init') {
    const started = performance.now();
    const { time, value } = generateHighResLoad(request.demand);
    const generateMs = performance.now() - started;
    // The series is copied into WASM memory once; each request then only passes the range.
    const wasm = (await loadWasm()) ? createWasmSeries(time, value) : null;
    store?.wasm?.free();
    store = { time, value, wasm };

    // Transfer a copy to the page for the readout and table; the worker keeps its own.
    const copy = { time: time.slice(), value: value.slice() };
    scope.postMessage({ type: 'ready', ...copy, generateMs, wasm: wasm !== null }, [
      copy.time.buffer,
      copy.value.buffer,
    ]);
    return;
  }

  if (request.type === 'downsample') {
    const answer = runDownsample(requireStore(), request.request);
    scope.postMessage({ type: 'result', id: request.id, answer }, [
      answer.time.buffer,
      answer.value.buffer,
    ]);
    return;
  }

  const rows = runBenchmark(requireStore(), request.buckets);
  scope.postMessage({ type: 'benchmark', id: request.id, rows });
};

scope.onmessage = ({ data: request }) => {
  handle(request).catch((error: unknown) => {
    scope.postMessage({
      type: 'error',
      id: request.type === 'init' ? undefined : request.id,
      message: error instanceof Error ? error.message : String(error),
    });
  });
};
