import { TELEMETRY_STATUSES } from '@pgo/grid-model';
import type { TelemetryDataset, TelemetryFilters } from './types';

/** Assets that pass the asset-level filters (text, kind, zone). */
export const matchAssets = (dataset: TelemetryDataset, filters: TelemetryFilters) => {
  const text = filters.text.trim().toLowerCase();
  return dataset.assets.filter(
    (asset) =>
      (filters.kind === 'all' || asset.kind === filters.kind) &&
      (filters.zone === 'all' || asset.zone === filters.zone) &&
      (!text || asset.name.toLowerCase().includes(text) || asset.id.includes(text)),
  );
};

/**
 * Row indices that pass every filter, in natural order. Rows are stored asset by asset, so
 * matching assets map to contiguous slices; only the status filter is checked per row.
 */
export const filterRows = (dataset: TelemetryDataset, filters: TelemetryFilters): Uint32Array => {
  const { steps } = dataset.columns;
  const assets = matchAssets(dataset, filters).sort((a, b) => a.index - b.index);
  const status = filters.status === 'all' ? -1 : TELEMETRY_STATUSES.indexOf(filters.status);

  const rows = new Uint32Array(assets.length * steps);
  let count = 0;
  for (const asset of assets) {
    const start = asset.index * steps;
    for (let row = start; row < start + steps; row += 1) {
      if (status < 0 || dataset.severity[row] === status) {
        rows[count] = row;
        count += 1;
      }
    }
  }
  return rows.subarray(0, count);
};
