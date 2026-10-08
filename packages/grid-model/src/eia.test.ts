import { describe, expect, it, vi } from 'vitest';
import {
  buildEiaUrl,
  fetchEiaRows,
  fetchErcotSnapshot,
  lastDaysRange,
  parseFuelRows,
  parseRegionRows,
  toEiaHour,
  type EiaRow,
} from './eia.ts';

const REGION_ROWS: EiaRow[] = [
  { period: '2026-10-08T02', type: 'D', 'type-name': 'Demand', value: '51000' },
  { period: '2026-10-08T01', type: 'D', 'type-name': 'Demand', value: '52000' },
  { period: '2026-10-08T01', type: 'DF', 'type-name': 'Day-ahead demand forecast', value: '51500' },
  { period: '2026-10-08T01', type: 'TI', 'type-name': 'Total interchange', value: '-792' },
  { period: '2026-10-08T02', type: 'NG', 'type-name': 'Net generation', value: '' },
  { period: '2026-10-08T01', type: 'XX', 'type-name': 'Unknown', value: '1' },
];

const FUEL_ROWS: EiaRow[] = [
  { period: '2026-10-08T01', fueltype: 'WND', 'type-name': 'Wind', value: '9000' },
  { period: '2026-10-08T01', fueltype: 'SUN', 'type-name': 'Solar', value: null },
];

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseRegionRows', () => {
  it('groups rows into ascending series and parses values', () => {
    const series = parseRegionRows(REGION_ROWS);

    expect(series.map((s) => s.id).sort()).toEqual([
      'demand',
      'forecast',
      'generation',
      'interchange',
    ]);
    const demand = series.find((s) => s.id === 'demand')!;
    expect(demand.name).toBe('Demand');
    expect(demand.points).toEqual([
      { period: '2026-10-08T01', value: 52000 },
      { period: '2026-10-08T02', value: 51000 },
    ]);
    expect(series.find((s) => s.id === 'interchange')!.points[0].value).toBe(-792);
  });

  it('turns empty values into null', () => {
    const generation = parseRegionRows(REGION_ROWS).find((s) => s.id === 'generation')!;
    expect(generation.points[0].value).toBeNull();
  });
});

describe('parseFuelRows', () => {
  it('creates one fuel:<code> series per fuel type', () => {
    const series = parseFuelRows(FUEL_ROWS);
    expect(series.map((s) => [s.id, s.name])).toEqual([
      ['fuel:WND', 'Wind'],
      ['fuel:SUN', 'Solar'],
    ]);
    expect(series[1].points[0].value).toBeNull();
  });
});

describe('ranges and URLs', () => {
  it('formats UTC hours the way EIA expects', () => {
    expect(toEiaHour(Date.UTC(2026, 9, 8, 5, 30))).toBe('2026-10-08T05');
  });

  it('covers the past days plus the day-ahead forecast', () => {
    const now = Date.UTC(2026, 9, 8, 12);
    expect(lastDaysRange(30, now)).toEqual({ start: '2026-09-08T12', end: '2026-10-10T00' });
  });

  it('builds a filtered, sorted, paginated request for ERCOT', () => {
    const url = new URL(
      buildEiaUrl('region-data', 'KEY', { start: '2026-10-01T00', end: '2026-10-02T00' }, 5000),
    );
    expect(url.pathname).toBe('/v2/electricity/rto/region-data/data/');
    expect(url.searchParams.get('facets[respondent][]')).toBe('ERCO');
    expect(url.searchParams.get('frequency')).toBe('hourly');
    expect(url.searchParams.get('offset')).toBe('5000');
    expect(url.searchParams.get('start')).toBe('2026-10-01T00');
  });
});

describe('fetchEiaRows', () => {
  const range = { start: '2026-10-01T00', end: '2026-10-02T00' };

  it('follows pages until the total is reached', async () => {
    const page = Array.from({ length: 5000 }, () => REGION_ROWS[0]);
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ response: { total: 5002, data: page } }))
      .mockResolvedValueOnce(
        jsonResponse({ response: { total: 5002, data: REGION_ROWS.slice(0, 2) } }),
      );

    const rows = await fetchEiaRows('region-data', 'KEY', range, undefined, fetchFn);

    expect(rows).toHaveLength(5002);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchFn.mock.calls[1][0])).searchParams.get('offset')).toBe('5000');
  });

  it('throws without leaking the API key', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 403));

    await expect(fetchEiaRows('region-data', 'SECRET', range, undefined, fetchFn)).rejects.toThrow(
      /status 403/,
    );
    await expect(
      fetchEiaRows('region-data', 'SECRET', range, undefined, fetchFn),
    ).rejects.not.toThrow(/SECRET/);
  });

  it('passes fetch options through, e.g. Next.js caching', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ response: { total: 0, data: [] } }));
    const init = { cache: 'no-store' } as RequestInit;

    await fetchEiaRows('fuel-type-data', 'KEY', range, init, fetchFn);

    expect(fetchFn.mock.calls[0][1]).toBe(init);
  });
});

describe('fetchErcotSnapshot', () => {
  it('combines region and fuel series and credits EIA', async () => {
    const fetchFn = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        jsonResponse({
          response: {
            total: 2,
            data: String(input).includes('fuel-type-data') ? FUEL_ROWS : REGION_ROWS,
          },
        }),
      ),
    );

    const snapshot = await fetchErcotSnapshot('KEY', { start: 'a', end: 'b' }, undefined, fetchFn);

    expect(snapshot.source).toBe('U.S. Energy Information Administration');
    expect(snapshot.respondent).toBe('ERCO');
    expect(snapshot.series.map((s) => s.id)).toEqual(
      expect.arrayContaining(['demand', 'forecast', 'fuel:WND']),
    );
  });
});
