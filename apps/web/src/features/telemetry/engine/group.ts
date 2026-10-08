import { ASSET_KINDS, TELEMETRY_STATUSES, WEATHER_ZONES } from '@pgo/grid-model';
import { groupMarker, type GroupBy, type GroupSummary, type TelemetryDataset } from './types';

interface Grouping {
  /** Number of possible groups. */
  size: number;
  /** Group position of a row; groups are listed in position order. */
  groupOf: (row: number) => number;
  keyOf: (position: number) => string;
}

const createGrouping = (dataset: TelemetryDataset, groupBy: Exclude<GroupBy, 'none'>): Grouping => {
  const asset = dataset.columns.assetIndex;
  switch (groupBy) {
    case 'kind':
      return {
        size: ASSET_KINDS.length,
        groupOf: (row) => dataset.kindIndex[asset[row]],
        keyOf: (position) => ASSET_KINDS[position],
      };
    case 'zone':
      return {
        size: WEATHER_ZONES.length,
        groupOf: (row) => dataset.zoneIndex[asset[row]],
        keyOf: (position) => WEATHER_ZONES[position],
      };
    case 'asset': {
      // Ordered by asset name.
      const byRank = new Uint16Array(dataset.assets.length);
      dataset.assetNameRank.forEach((rank, index) => {
        byRank[rank] = index;
      });
      return {
        size: dataset.assets.length,
        groupOf: (row) => dataset.assetNameRank[asset[row]],
        keyOf: (position) => dataset.assets[byRank[position]].id,
      };
    }
    case 'status':
      // Most severe first.
      return {
        size: TELEMETRY_STATUSES.length,
        groupOf: (row) => TELEMETRY_STATUSES.length - 1 - dataset.severity[row],
        keyOf: (position) => TELEMETRY_STATUSES[TELEMETRY_STATUSES.length - 1 - position],
      };
  }
};

/**
 * Splits sorted rows into groups (keeping their order within each group) and builds the
 * display order: each group's header, followed by its rows when the group is expanded.
 */
export const groupRows = (
  dataset: TelemetryDataset,
  rows: Uint32Array,
  groupBy: GroupBy,
  expanded: ReadonlySet<string>,
): { order: Uint32Array; groups: GroupSummary[] } => {
  if (groupBy === 'none') {
    return { order: rows, groups: [] };
  }
  const { size, groupOf, keyOf } = createGrouping(dataset, groupBy);
  const { mw, loadingPct } = dataset.columns;

  const counts = new Uint32Array(size);
  const sumMw = new Float64Array(size);
  const maxMw = new Float64Array(size).fill(-Infinity);
  const maxLoading = new Float64Array(size).fill(-Infinity);
  const worst = new Uint8Array(size);
  const rowGroup = new Uint32Array(rows.length);

  rows.forEach((row, i) => {
    const group = groupOf(row);
    rowGroup[i] = group;
    counts[group] += 1;
    sumMw[group] += mw[row];
    maxMw[group] = Math.max(maxMw[group], mw[row]);
    maxLoading[group] = Math.max(maxLoading[group], loadingPct[row]);
    worst[group] = Math.max(worst[group], dataset.severity[row]);
  });

  // Non-empty groups, in group order.
  const present: number[] = [];
  counts.forEach((count, group) => {
    if (count > 0) present.push(group);
  });
  const groups = present.map((group): GroupSummary => ({
    key: keyOf(group),
    count: counts[group],
    avgMw: sumMw[group] / counts[group],
    maxMw: maxMw[group],
    maxLoadingPct: maxLoading[group],
    worstStatus: TELEMETRY_STATUSES[worst[group]],
  }));

  // Bucket the rows of expanded groups, preserving their sorted order.
  const isExpanded = present.map((group) => expanded.has(keyOf(group)));
  const positionOf = new Int32Array(size).fill(-1);
  present.forEach((group, position) => {
    positionOf[group] = position;
  });
  const starts = new Uint32Array(present.length);
  let length = present.length;
  present.forEach((group, position) => {
    if (isExpanded[position]) {
      starts[position] = length;
      length += counts[group];
    }
  });

  const order = new Uint32Array(length);
  const cursor = new Uint32Array(present.length);
  rows.forEach((row, i) => {
    const position = positionOf[rowGroup[i]];
    if (isExpanded[position]) {
      order[starts[position] + cursor[position]] = row;
      cursor[position] += 1;
    }
  });

  // Interleave headers and expanded rows.
  const display = new Uint32Array(length);
  let out = 0;
  present.forEach((group, position) => {
    display[out] = groupMarker(position);
    out += 1;
    if (isExpanded[position]) {
      display.set(order.subarray(starts[position], starts[position] + counts[group]), out);
      out += counts[group];
    }
  });
  return { order: display, groups };
};
