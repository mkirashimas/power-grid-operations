import { EIA_SOURCE } from './synthetic.ts';
import type { EiaSeries, EiaSnapshot } from './types.ts';

export const EIA_API_BASE = 'https://api.eia.gov/v2/electricity/rto';

/** EIA region-data types and the series ids we store them under. */
export const REGION_SERIES = {
  D: 'demand',
  DF: 'forecast',
  NG: 'generation',
  TI: 'interchange',
} as const;

export type EiaRoute = 'region-data' | 'fuel-type-data';

/** One row of an EIA v2 response. Values arrive as strings. */
export interface EiaRow {
  period: string;
  value: string | number | null;
  type?: string;
  fueltype?: string;
  'type-name'?: string;
}

export interface EiaRange {
  /** First and last UTC hour, inclusive, e.g. "2026-09-08T00". */
  start: string;
  end: string;
}

const PAGE_SIZE = 5000;
const HOUR_MS = 3_600_000;

/** Epoch ms to an EIA hourly period ("2026-10-09T05", UTC). */
export const toEiaHour = (ms: number) => new Date(ms).toISOString().slice(0, 13);

/** The last `days` days, extended a day ahead so the day-ahead forecast is included. */
export const lastDaysRange = (days: number, now = Date.now()): EiaRange => ({
  start: toEiaHour(now - days * 24 * HOUR_MS),
  end: toEiaHour(now + 36 * HOUR_MS),
});

export const buildEiaUrl = (
  route: EiaRoute,
  apiKey: string,
  range: EiaRange,
  offset = 0,
  length = PAGE_SIZE,
) => {
  const params = new URLSearchParams({
    api_key: apiKey,
    frequency: 'hourly',
    'data[0]': 'value',
    'facets[respondent][]': 'ERCO',
    start: range.start,
    end: range.end,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
    offset: String(offset),
    length: String(length),
  });
  return `${EIA_API_BASE}/${route}/data/?${params}`;
};

const toNumber = (value: EiaRow['value']) => {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Groups rows into one ascending series per key. Pure, so it is tested against fixtures. */
const toSeries = (rows: EiaRow[], keyOf: (row: EiaRow) => string | undefined): EiaSeries[] => {
  const byId = new Map<string, EiaSeries>();
  rows.forEach((row) => {
    const id = keyOf(row);
    if (!id) return;
    const series = byId.get(id) ?? { id, name: row['type-name'] ?? id, unit: 'MWh', points: [] };
    series.points.push({ period: row.period, value: toNumber(row.value) });
    byId.set(id, series);
  });
  return [...byId.values()].map((series) => ({
    ...series,
    points: series.points.sort((a, b) => a.period.localeCompare(b.period)),
  }));
};

export const parseRegionRows = (rows: EiaRow[]): EiaSeries[] =>
  toSeries(rows, (row) =>
    row.type && row.type in REGION_SERIES
      ? REGION_SERIES[row.type as keyof typeof REGION_SERIES]
      : undefined,
  );

export const parseFuelRows = (rows: EiaRow[]): EiaSeries[] =>
  toSeries(rows, (row) => (row.fueltype ? `fuel:${row.fueltype}` : undefined));

interface EiaResponse {
  response?: { total?: number | string; data?: EiaRow[] };
  error?: string;
}

/** Fetches every page of a route. `init` is passed to fetch, e.g. Next.js caching options. */
export const fetchEiaRows = async (
  route: EiaRoute,
  apiKey: string,
  range: EiaRange,
  init?: RequestInit,
  fetchFn: typeof fetch = fetch,
): Promise<EiaRow[]> => {
  const rows: EiaRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await fetchFn(buildEiaUrl(route, apiKey, range, offset), init);
    // Never include the URL in errors: it contains the API key.
    if (!response.ok) {
      throw new Error(`EIA ${route} request failed with status ${response.status}`);
    }
    const body = (await response.json()) as EiaResponse;
    if (body.error || !body.response?.data) {
      throw new Error(`EIA ${route} returned an error: ${body.error ?? 'no data'}`);
    }
    rows.push(...body.response.data);
    const total = Number(body.response.total ?? rows.length);
    if (body.response.data.length < PAGE_SIZE || rows.length >= total) {
      return rows;
    }
  }
};

/** Downloads demand, forecast, generation, interchange and generation by fuel for ERCOT. */
export const fetchErcotSnapshot = async (
  apiKey: string,
  range: EiaRange,
  init?: RequestInit,
  fetchFn: typeof fetch = fetch,
): Promise<EiaSnapshot> => {
  const [regionRows, fuelRows] = await Promise.all([
    fetchEiaRows('region-data', apiKey, range, init, fetchFn),
    fetchEiaRows('fuel-type-data', apiKey, range, init, fetchFn),
  ]);
  return {
    source: EIA_SOURCE,
    respondent: 'ERCO',
    fetchedAt: new Date().toISOString(),
    start: range.start,
    end: range.end,
    series: [...parseRegionRows(regionRows), ...parseFuelRows(fuelRows)],
  };
};

export const findSeries = (snapshot: EiaSnapshot, id: string) =>
  snapshot.series.find((series) => series.id === id);
