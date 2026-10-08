'use client';

import type { Asset, HourlyPoint, TelemetryColumns } from '@pgo/grid-model';
import { useEffect, useRef, useState } from 'react';
import type { QueryResult, TelemetryQuery } from '../engine/types';
import type { WorkerRequest, WorkerResponse } from '../worker/protocol';

export type TelemetryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      assets: Asset[];
      columns: TelemetryColumns;
      generateMs: number;
      /** Undefined until the first query answers. */
      result?: QueryResult;
      /** True while a newer query is running. */
      pending: boolean;
    };

/**
 * Runs the telemetry worker: generates the data once, then re-runs `query` whenever it
 * changes. Results of superseded queries are dropped.
 */
export const useTelemetryWorker = (
  demand: HourlyPoint[],
  seed: number,
  query: TelemetryQuery,
): TelemetryState => {
  const [state, setState] = useState<TelemetryState>({ status: 'loading' });
  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);
  // Server re-renders (e.g. a language switch) pass an equal but new array: only restart the
  // worker when the data itself changes.
  const demandKey = `${demand.length}:${demand[0]?.period}:${demand.at(-1)?.period}`;
  const demandRef = useRef(demand);
  // Runs before the worker effect below (effects run in order).
  useEffect(() => {
    demandRef.current = demand;
  });

  useEffect(() => {
    const worker = new Worker(new URL('../worker/telemetry.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'ready') {
        setState({ status: 'ready', ...data, pending: true });
      } else if (data.type === 'result') {
        if (data.id !== latestId.current) return;
        setState((current) =>
          current.status === 'ready'
            ? { ...current, result: data.result, pending: false }
            : current,
        );
      } else {
        setState({ status: 'error', message: data.message });
      }
    };
    worker.onerror = (event) => setState({ status: 'error', message: event.message });
    worker.postMessage({ type: 'init', demand: demandRef.current, seed } satisfies WorkerRequest);
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [demandKey, seed]);

  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready || !workerRef.current) return;
    latestId.current += 1;
    setState((current) => (current.status === 'ready' ? { ...current, pending: true } : current));
    workerRef.current.postMessage({
      type: 'query',
      id: latestId.current,
      query,
    } satisfies WorkerRequest);
  }, [ready, query]);

  return state;
};
