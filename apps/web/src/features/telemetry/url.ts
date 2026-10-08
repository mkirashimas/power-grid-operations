import { ASSET_KINDS, TELEMETRY_STATUSES, WEATHER_ZONES } from '@pgo/grid-model';
import {
  COLUMN_IDS,
  GROUP_BY_OPTIONS,
  type SortKey,
  type TelemetryFilters,
  type TelemetryQuery,
} from './engine/types';
import { DEFAULT_QUERY } from './slice';

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/** Query → URL search params. Defaults are omitted; expanded groups are not shared. */
export const toSearchParams = (query: TelemetryQuery): URLSearchParams => {
  const params = new URLSearchParams();
  const { text, kind, zone, status } = query.filters;
  if (text) params.set('q', text);
  if (kind !== 'all') params.set('kind', kind);
  if (zone !== 'all') params.set('zone', zone);
  if (status !== 'all') params.set('status', status);
  if (query.sort.length) {
    params.set(
      'sort',
      query.sort.map(({ column, direction }) => `${column}:${direction}`).join(','),
    );
  }
  if (query.groupBy !== 'none') params.set('group', query.groupBy);
  return params;
};

/** URL search params → query. Unknown values fall back to the defaults. */
export const fromSearchParams = (params: URLSearchParams): TelemetryQuery => {
  const filters: TelemetryFilters = {
    text: params.get('q') ?? '',
    kind: oneOf(['all', ...ASSET_KINDS], params.get('kind'), 'all'),
    zone: oneOf(['all', ...WEATHER_ZONES], params.get('zone'), 'all'),
    status: oneOf(['all', ...TELEMETRY_STATUSES], params.get('status'), 'all'),
  };
  const sort = (params.get('sort') ?? '')
    .split(',')
    .map((part) => part.split(':'))
    .filter(
      ([column, direction]) =>
        COLUMN_IDS.some((id) => id === column) && (direction === 'asc' || direction === 'desc'),
    )
    .map(([column, direction]) => ({ column, direction }) as SortKey)
    .filter((key, i, all) => all.findIndex((other) => other.column === key.column) === i);
  return {
    ...DEFAULT_QUERY,
    filters,
    sort,
    groupBy: oneOf(GROUP_BY_OPTIONS, params.get('group'), 'none'),
  };
};
