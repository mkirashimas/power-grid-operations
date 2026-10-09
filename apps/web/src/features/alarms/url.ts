import { WEATHER_ZONES } from '@pgo/grid-model';
import type { SeverityFilter, ZoneFilter } from './live';
import { DEFAULT_FILTERS, type AlarmFilters } from './slice';

const SEVERITIES: SeverityFilter[] = ['all', 'alarm', 'warning'];
const ZONES: ZoneFilter[] = ['all', ...WEATHER_ZONES];

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/** Filters → `severity` / `zone` search params, left out when they are the defaults. */
export const toSearchParams = ({ severity, zone }: AlarmFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (severity !== DEFAULT_FILTERS.severity) params.set('severity', severity);
  if (zone !== DEFAULT_FILTERS.zone) params.set('zone', zone);
  return params;
};

/** Search params → filters; unknown values fall back to the defaults. */
export const fromSearchParams = (params: URLSearchParams): AlarmFilters => ({
  severity: oneOf(SEVERITIES, params.get('severity'), DEFAULT_FILTERS.severity),
  zone: oneOf(ZONES, params.get('zone'), DEFAULT_FILTERS.zone),
});
