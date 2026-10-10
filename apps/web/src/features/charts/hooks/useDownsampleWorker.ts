'use client';

import type { Algorithm, Engine } from '@pgo/downsample';
import type { HourlyPoint } from '@pgo/grid-model';
import type { DownsampledLine, PaneDownsampler } from '@pgo/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BenchmarkRow, DownsampleAnswer } from '../engine/run';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

export type HighResState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      time: Float64Array;
      value: Float32Array;
      generateMs: number;
      /** False when the WASM module failed to load. */
      wasm: boolean;
    };

interface Pending {
  resolve: (data: WorkerResponse) => void;
  reject: (error: Error) => void;
}

export interface DownsampleWorker {
  state: HighResState;
  /** Downsamples the 1-second series in the worker; undefined until the worker is ready. */
  downsample?: PaneDownsampler;
  /** The engine that answered the latest request (JS when WASM is unavailable). */
  lastEngine?: Engine;
  runBenchmark: (buckets: number) => Promise<BenchmarkRow[]>;
}

/**
 * Runs the downsampling worker: it generates the 1-second series once, then answers downsample
 * requests with the given engine and algorithm, and benchmark requests.
 */
export const useDownsampleWorker = (
  demand: HourlyPoint[] | undefined,
  engine: Engine,
  algorithm: Algorithm,
): DownsampleWorker => {
  const [state, setState] = useState<HighResState>({ status: 'loading' });
  const [lastEngine, setLastEngine] = useState<Engine>();
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(0);
  // Server re-renders (e.g. a language switch) pass an equal but new array: only restart the
  // worker when the data itself changes.
  const demandKey = demand ? `${demand.length}:${demand[0]?.period}:${demand.at(-1)?.period}` : '';
  const demandRef = useRef(demand);
  // Runs before the worker effect below (effects run in order).
  useEffect(() => {
    demandRef.current = demand;
  });

  useEffect(() => {
    if (!demandRef.current) return;
    const worker = new Worker(new URL('../worker/downsample.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    const requests = pending.current;
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'ready') {
        const { time, value, generateMs, wasm } = data;
        setState({ status: 'ready', time, value, generateMs, wasm });
        return;
      }
      if (data.id === undefined) {
        setState({ status: 'error', message: data.type === 'error' ? data.message : '' });
        return;
      }
      const request = requests.get(data.id);
      requests.delete(data.id);
      if (data.type === 'error') request?.reject(new Error(data.message));
      else request?.resolve(data);
    };
    worker.onerror = (event) => setState({ status: 'error', message: event.message });
    worker.postMessage({ type: 'init', demand: demandRef.current } satisfies WorkerRequest);
    return () => {
      worker.terminate();
      workerRef.current = null;
      requests.forEach(({ reject }) => reject(new Error('The worker was stopped')));
      requests.clear();
    };
  }, [demandKey]);

  const send = useCallback((request: WorkerRequest & { id: number }) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error('The worker is not running'));
    return new Promise<WorkerResponse>((resolve, reject) => {
      pending.current.set(request.id, { resolve, reject });
      worker.postMessage(request satisfies WorkerRequest);
    });
  }, []);

  const ready = state.status === 'ready';
  // A new function per engine and algorithm, so panes request their lines again on a switch.
  const downsample = useMemo<PaneDownsampler | undefined>(() => {
    if (!ready) return undefined;
    return async (_series, from, to, buckets): Promise<DownsampledLine> => {
      nextId.current += 1;
      const request = { engine, algorithm, from, to, buckets };
      const data = await send({ type: 'downsample', id: nextId.current, request });
      const { answer } = data as Extract<WorkerResponse, { type: 'result' }>;
      setLastEngine(answer.engine);
      return answer satisfies DownsampleAnswer;
    };
  }, [ready, engine, algorithm, send]);

  const runBenchmark = useCallback(
    async (buckets: number) => {
      nextId.current += 1;
      const data = await send({ type: 'benchmark', id: nextId.current, buckets });
      return (data as Extract<WorkerResponse, { type: 'benchmark' }>).rows;
    },
    [send],
  );

  return { state, downsample, lastEngine, runBenchmark };
};
