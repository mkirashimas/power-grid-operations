import type { Asset, HourlyPoint, TelemetryColumns } from '@pgo/grid-model';
import type { QueryResult, TelemetryQuery } from '../engine/types';

/** Messages from the page to the telemetry worker. */
export type WorkerRequest =
  | { type: 'init'; demand: HourlyPoint[]; seed: number }
  | { type: 'query'; id: number; query: TelemetryQuery };

/** Messages from the telemetry worker to the page. */
export type WorkerResponse =
  | {
      type: 'ready';
      assets: Asset[];
      /** A copy for rendering cells synchronously; the worker keeps its own for queries. */
      columns: TelemetryColumns;
      generateMs: number;
    }
  | { type: 'result'; id: number; result: QueryResult }
  | { type: 'error'; message: string };
