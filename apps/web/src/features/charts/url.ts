import { ALGORITHMS, ENGINES, type Algorithm, type Engine } from '@pgo/downsample';
import { DEFAULT_CHARTS_STATE, type ChartsState } from './slice';

const toHour = (ms: number) => new Date(ms).toISOString().slice(0, 16) + 'Z';

const oneOf = <T extends string>(options: readonly T[], value: string | null, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/** Search params this view owns; the rest of the URL (e.g. `asset`) is kept. */
export const SEARCH_KEYS = ['from', 'to', 'engine', 'algo'] as const;

/**
 * View → search params: `from`/`to` as UTC minutes (e.g. 2026-10-01T05:00Z), plus `engine` and
 * `algo` when they differ from the defaults.
 */
export const toSearchParams = ({ domain, engine, algorithm }: ChartsState): URLSearchParams => {
  const params = new URLSearchParams();
  if (domain) {
    params.set('from', toHour(domain[0]));
    params.set('to', toHour(domain[1]));
  }
  if (engine !== DEFAULT_CHARTS_STATE.engine) params.set('engine', engine);
  if (algorithm !== DEFAULT_CHARTS_STATE.algorithm) params.set('algo', algorithm);
  return params;
};

/** Search params → view; missing or invalid values fall back to the defaults. */
export const fromSearchParams = (params: URLSearchParams): ChartsState => {
  const from = Date.parse(params.get('from') ?? '');
  const to = Date.parse(params.get('to') ?? '');
  return {
    domain: Number.isFinite(from) && Number.isFinite(to) && from < to ? [from, to] : null,
    engine: oneOf<Engine>(ENGINES, params.get('engine'), DEFAULT_CHARTS_STATE.engine),
    algorithm: oneOf<Algorithm>(ALGORITHMS, params.get('algo'), DEFAULT_CHARTS_STATE.algorithm),
  };
};
