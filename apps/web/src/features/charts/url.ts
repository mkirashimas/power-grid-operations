const toHour = (ms: number) => new Date(ms).toISOString().slice(0, 16) + 'Z';

/** Range → `from`/`to` search params, as UTC minutes (e.g. 2026-10-01T05:00Z). */
export const toSearchParams = (domain: [number, number] | null): URLSearchParams => {
  const params = new URLSearchParams();
  if (domain) {
    params.set('from', toHour(domain[0]));
    params.set('to', toHour(domain[1]));
  }
  return params;
};

/** `from`/`to` search params → range, or null when absent or invalid. */
export const fromSearchParams = (params: URLSearchParams): [number, number] | null => {
  const from = Date.parse(params.get('from') ?? '');
  const to = Date.parse(params.get('to') ?? '');
  return Number.isFinite(from) && Number.isFinite(to) && from < to ? [from, to] : null;
};
