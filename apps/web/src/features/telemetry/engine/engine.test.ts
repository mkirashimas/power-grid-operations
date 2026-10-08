import {
  generateAssets,
  generateTelemetry,
  statusOf,
  type HourlyPoint,
  type TelemetryStatus,
} from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { createDataset } from './dataset';
import { filterRows } from './filter';
import { groupRows } from './group';
import { runQuery } from './query';
import { sortRows } from './sort';
import { groupMarker, type TelemetryFilters, type TelemetryQuery } from './types';

// A small grid: 30 substations, one day of hourly readings.
const demand: HourlyPoint[] = Array.from({ length: 48 }, (_, hour) => ({
  period: `2026-10-0${1 + Math.floor(hour / 24)}T${String(hour % 24).padStart(2, '0')}`,
  value: 40_000 + 15_000 * Math.sin((Math.PI * (hour % 24)) / 24),
}));
const assets = generateAssets({ substations: 30, generators: 20 });
const columns = generateTelemetry(assets, demand, {
  start: Date.UTC(2026, 9, 1),
  end: Date.UTC(2026, 9, 2),
  intervalMinutes: 60,
});
const dataset = createDataset(assets, columns);

const ALL: TelemetryFilters = { text: '', kind: 'all', zone: 'all', status: 'all' };
const allRows = () => Uint32Array.from({ length: columns.length }, (_, i) => i);
const statusAt = (row: number): TelemetryStatus =>
  statusOf(columns.loadingPct[row], columns.voltagePu[row]);

describe('filterRows', () => {
  it('returns every row in natural order without filters', () => {
    expect(Array.from(filterRows(dataset, ALL))).toEqual(Array.from(allRows()));
  });

  it.each<Partial<TelemetryFilters>>([
    { kind: 'generator' },
    { zone: 'coast' },
    { text: 'cst' },
    { text: 'ln-00' },
    { status: 'warning' },
    { kind: 'line', zone: 'north-central', status: 'normal' },
  ])('matches a brute-force check for %o', (partial) => {
    const filters = { ...ALL, ...partial };
    const text = filters.text.toLowerCase();
    const expected = Array.from(allRows()).filter((row) => {
      const asset = assets[columns.assetIndex[row]];
      return (
        (filters.kind === 'all' || asset.kind === filters.kind) &&
        (filters.zone === 'all' || asset.zone === filters.zone) &&
        (!text || asset.name.toLowerCase().includes(text) || asset.id.includes(text)) &&
        (filters.status === 'all' || statusAt(row) === filters.status)
      );
    });
    expect(Array.from(filterRows(dataset, filters))).toEqual(expected);
  });
});

describe('sortRows', () => {
  it('sorts by one column in either direction', () => {
    const desc = sortRows(dataset, allRows(), [{ column: 'mw', direction: 'desc' }]);
    for (let i = 1; i < desc.length; i += 1) {
      expect(columns.mw[desc[i - 1]]).toBeGreaterThanOrEqual(columns.mw[desc[i]]);
    }
    const asc = sortRows(dataset, allRows(), [{ column: 'mw', direction: 'asc' }]);
    expect(asc[0]).toBe(desc[desc.length - 1]);
  });

  it('sorts by several columns and keeps natural order on ties (stable)', () => {
    const sorted = sortRows(dataset, allRows(), [
      { column: 'kind', direction: 'asc' },
      { column: 'zone', direction: 'desc' },
    ]);
    for (let i = 1; i < sorted.length; i += 1) {
      const [a, b] = [sorted[i - 1], sorted[i]];
      const [ka, kb] = [
        dataset.kindIndex[columns.assetIndex[a]],
        dataset.kindIndex[columns.assetIndex[b]],
      ];
      const [za, zb] = [
        dataset.zoneIndex[columns.assetIndex[a]],
        dataset.zoneIndex[columns.assetIndex[b]],
      ];
      expect(ka).toBeLessThanOrEqual(kb);
      if (ka === kb) {
        expect(za).toBeGreaterThanOrEqual(zb);
        if (za === zb) expect(a).toBeLessThan(b);
      }
    }
  });

  it('sorts assets by name', () => {
    const sorted = sortRows(dataset, allRows(), [{ column: 'asset', direction: 'asc' }]);
    const names = Array.from(sorted, (row) => assets[columns.assetIndex[row]].name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })));
  });
});

describe('groupRows', () => {
  it('summarises each group and keeps groups collapsed by default', () => {
    const { order, groups } = groupRows(dataset, allRows(), 'kind', new Set());

    expect(groups.map((g) => g.key)).toEqual(['substation', 'line', 'generator', 'load']);
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(columns.length);
    expect(Array.from(order)).toEqual(groups.map((_, i) => groupMarker(i)));

    const generators = groups[2];
    const rows = Array.from(allRows()).filter(
      (row) => assets[columns.assetIndex[row]].kind === 'generator',
    );
    expect(generators.count).toBe(rows.length);
    expect(generators.maxMw).toBeCloseTo(Math.max(...rows.map((row) => columns.mw[row])), 3);
    expect(generators.avgMw).toBeCloseTo(
      rows.reduce((sum, row) => sum + columns.mw[row], 0) / rows.length,
      3,
    );
  });

  it('lists the rows of expanded groups after their header, in sorted order', () => {
    const sorted = sortRows(dataset, allRows(), [{ column: 'mw', direction: 'desc' }]);
    const { order, groups } = groupRows(dataset, sorted, 'zone', new Set(['coast']));
    const coast = groups.findIndex((g) => g.key === 'coast');
    const header = order.indexOf(groupMarker(coast));
    const members = Array.from(order.subarray(header + 1, header + 1 + groups[coast].count));

    expect(order.length).toBe(groups.length + groups[coast].count);
    members.forEach((row) => expect(assets[columns.assetIndex[row]].zone).toBe('coast'));
    for (let i = 1; i < members.length; i += 1) {
      expect(columns.mw[members[i - 1]]).toBeGreaterThanOrEqual(columns.mw[members[i]]);
    }
  });

  it('puts the most severe status group first', () => {
    const { groups } = groupRows(dataset, allRows(), 'status', new Set());
    const order = ['alarm', 'warning', 'normal'];
    const keys = groups.map((g) => g.key);
    expect(keys).toEqual(order.filter((key) => keys.includes(key)));
    groups.forEach((g) => expect(g.worstStatus).toBe(g.key));
  });
});

describe('runQuery', () => {
  it('filters, sorts and groups, reporting counts and timings', () => {
    const query: TelemetryQuery = {
      filters: { ...ALL, kind: 'load' },
      sort: [{ column: 'loading', direction: 'desc' }],
      groupBy: 'none',
      expanded: [],
    };
    const result = runQuery(dataset, query);

    expect(result.matchedRows).toBe(30 * 24);
    expect(result.order).toHaveLength(30 * 24);
    expect(columns.loadingPct[result.order[0]]).toBe(
      Math.max(...Array.from(result.order, (row) => columns.loadingPct[row])),
    );
    Object.values(result.timings).forEach((ms) => expect(ms).toBeGreaterThanOrEqual(0));
  });
});
