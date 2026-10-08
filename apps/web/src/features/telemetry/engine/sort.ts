import type { ColumnId, SortKey, TelemetryDataset } from './types';

type KeyOf = (row: number) => number;

/** Numeric sort key for a column; text columns use precomputed ranks. */
export const keyOf = (dataset: TelemetryDataset, column: ColumnId): KeyOf => {
  const { columns, severity, assetNameRank, kindIndex, zoneIndex } = dataset;
  const asset = columns.assetIndex;
  switch (column) {
    case 'asset':
      return (row) => assetNameRank[asset[row]];
    case 'kind':
      return (row) => kindIndex[asset[row]];
    case 'zone':
      return (row) => zoneIndex[asset[row]];
    case 'time':
      return (row) => columns.timestamp[row];
    case 'mw':
      return (row) => columns.mw[row];
    case 'loading':
      return (row) => columns.loadingPct[row];
    case 'voltage':
      return (row) => columns.voltagePu[row];
    case 'status':
      return (row) => severity[row];
  }
};

/**
 * Sorts row indices by the given keys, primary first. Ties keep natural order (asset, then
 * time), so the result is stable and deterministic. Returns a new array.
 *
 * Keys are first copied into one Float64Array per sort column (with descending columns
 * negated), so the comparator reads plain arrays instead of calling lookups. The comparator is
 * unrolled for one and two keys, the common cases.
 */
export const sortRows = (dataset: TelemetryDataset, rows: Uint32Array, sort: SortKey[]) => {
  if (sort.length === 0) {
    return rows;
  }
  const n = rows.length;
  const keys = sort.map(({ column, direction }) => {
    const key = keyOf(dataset, column);
    const sign = direction === 'asc' ? 1 : -1;
    const values = new Float64Array(n);
    for (let i = 0; i < n; i += 1) values[i] = sign * key(rows[i]);
    return values;
  });

  // Sort positions 0..n-1; positions follow row order, so ties stay in natural order.
  const positions = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) positions[i] = i;
  const [a, b] = keys;
  if (keys.length === 1) {
    positions.sort((x, y) => a[x] - a[y] || x - y);
  } else if (keys.length === 2) {
    positions.sort((x, y) => a[x] - a[y] || b[x] - b[y] || x - y);
  } else {
    positions.sort((x, y) => {
      for (let k = 0; k < keys.length; k += 1) {
        const difference = keys[k][x] - keys[k][y];
        if (difference !== 0) return difference;
      }
      return x - y;
    });
  }

  const sorted = new Uint32Array(n);
  for (let i = 0; i < n; i += 1) sorted[i] = rows[positions[i]];
  return sorted;
};
