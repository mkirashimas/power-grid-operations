import { describe, expect, it } from 'vitest';
import type { TelemetryQuery } from './engine/types';
import { DEFAULT_QUERY } from './slice';
import { fromSearchParams, toSearchParams } from './url';

describe('telemetry URL state', () => {
  it('round-trips a query, without the expanded groups', () => {
    const query: TelemetryQuery = {
      filters: { text: 'cst', kind: 'line', zone: 'coast', status: 'warning' },
      sort: [
        { column: 'mw', direction: 'desc' },
        { column: 'time', direction: 'asc' },
      ],
      groupBy: 'zone',
      expanded: ['coast'],
    };
    const params = toSearchParams(query);

    expect(params.toString()).toBe(
      'q=cst&kind=line&zone=coast&status=warning&sort=mw%3Adesc%2Ctime%3Aasc&group=zone',
    );
    expect(fromSearchParams(params)).toEqual({ ...query, expanded: [] });
  });

  it('omits defaults', () => {
    expect(toSearchParams(DEFAULT_QUERY).toString()).toBe('');
  });

  it('ignores unknown or repeated values', () => {
    const query = fromSearchParams(
      new URLSearchParams(
        'kind=tower&zone=mars&status=bad&group=x&sort=mw:up,mw:asc,mw:desc,foo:asc',
      ),
    );
    expect(query.filters).toEqual(DEFAULT_QUERY.filters);
    expect(query.groupBy).toBe('none');
    expect(query.sort).toEqual([{ column: 'mw', direction: 'asc' }]);
  });
});
