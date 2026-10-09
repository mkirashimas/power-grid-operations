import type { TelemetryColumns } from '@pgo/grid-model';

export interface AssetSeries {
  time: Float64Array;
  mw: Float32Array;
  loadingPct: Float32Array;
}

/**
 * One asset's readings over time. Rows are ordered by asset, then time, so they are one
 * contiguous slice: views on the columns, nothing is copied.
 */
export const assetSeries = (columns: TelemetryColumns, assetIndex: number): AssetSeries => {
  const start = Math.min(columns.length, assetIndex * columns.steps);
  const end = Math.min(columns.length, start + columns.steps);
  return {
    time: columns.timestamp.subarray(start, end),
    mw: columns.mw.subarray(start, end),
    loadingPct: columns.loadingPct.subarray(start, end),
  };
};
