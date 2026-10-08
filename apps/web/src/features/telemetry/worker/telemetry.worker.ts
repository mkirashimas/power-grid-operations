// Generates the synthetic telemetry and answers queries off the main thread.
import { generateAssets, generateTelemetry, type TelemetryColumns } from '@pgo/grid-model';
import { createDataset } from '../engine/dataset';
import { runQuery } from '../engine/query';
import type { TelemetryDataset } from '../engine/types';
import type { WorkerRequest, WorkerResponse } from './protocol';

// Minimal worker scope typing; the app's tsconfig uses the DOM lib, not WebWorker.
const scope = self as unknown as {
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

let dataset: TelemetryDataset | undefined;

const copyColumns = (columns: TelemetryColumns): TelemetryColumns => ({
  ...columns,
  assetIndex: columns.assetIndex.slice(),
  timestamp: columns.timestamp.slice(),
  mw: columns.mw.slice(),
  loadingPct: columns.loadingPct.slice(),
  voltagePu: columns.voltagePu.slice(),
});

scope.onmessage = ({ data: request }) => {
  try {
    if (request.type === 'init') {
      const start = performance.now();
      const assets = generateAssets({ seed: request.seed });
      const columns = generateTelemetry(assets, request.demand, undefined, request.seed);
      dataset = createDataset(assets, columns);
      const generateMs = performance.now() - start;

      // Transfer a copy to the page so it can render cells without round trips.
      const copy = copyColumns(columns);
      scope.postMessage({ type: 'ready', assets, columns: copy, generateMs }, [
        copy.assetIndex.buffer,
        copy.timestamp.buffer,
        copy.mw.buffer,
        copy.loadingPct.buffer,
        copy.voltagePu.buffer,
      ]);
      return;
    }

    if (!dataset) {
      throw new Error('The telemetry worker received a query before init');
    }
    const result = runQuery(dataset, request.query);
    // The order is built per query; transfer it instead of copying.
    scope.postMessage({ type: 'result', id: request.id, result }, [result.order.buffer]);
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
