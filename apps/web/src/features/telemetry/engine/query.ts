import { filterRows } from './filter';
import { groupRows } from './group';
import { sortRows } from './sort';
import type { QueryResult, TelemetryDataset, TelemetryQuery } from './types';

const timed = <T>(run: () => T): [T, number] => {
  const start = performance.now();
  const value = run();
  return [value, performance.now() - start];
};

/** Filter → sort → group, timing each step. */
export const runQuery = (dataset: TelemetryDataset, query: TelemetryQuery): QueryResult => {
  const [filtered, filterMs] = timed(() => filterRows(dataset, query.filters));
  // filterRows returns a view; copy so sorting never touches a shared buffer.
  const [sorted, sortMs] = timed(() => sortRows(dataset, filtered.slice(), query.sort));
  const [{ order, groups }, groupMs] = timed(() =>
    groupRows(dataset, sorted, query.groupBy, new Set(query.expanded)),
  );
  return { order, groups, matchedRows: filtered.length, timings: { filterMs, sortMs, groupMs } };
};
