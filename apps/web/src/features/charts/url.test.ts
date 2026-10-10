import { describe, expect, it } from 'vitest';
import { DEFAULT_CHARTS_STATE } from './slice';
import { fromSearchParams, toSearchParams } from './url';

describe('charts URL state', () => {
  it('round-trips a range at minute precision', () => {
    const domain: [number, number] = [Date.UTC(2026, 9, 1, 5), Date.UTC(2026, 9, 8, 5, 30)];
    const params = toSearchParams({ ...DEFAULT_CHARTS_STATE, domain });
    expect(params.toString()).toBe('from=2026-10-01T05%3A00Z&to=2026-10-08T05%3A30Z');
    expect(fromSearchParams(params)).toEqual({ ...DEFAULT_CHARTS_STATE, domain });
  });

  it('treats a missing, invalid or reversed range as the default', () => {
    expect(toSearchParams(DEFAULT_CHARTS_STATE).toString()).toBe('');
    expect(fromSearchParams(new URLSearchParams(''))).toEqual(DEFAULT_CHARTS_STATE);
    expect(fromSearchParams(new URLSearchParams('from=yesterday&to=today')).domain).toBeNull();
    expect(
      fromSearchParams(new URLSearchParams('from=2026-10-08T00:00Z&to=2026-10-01T00:00Z')).domain,
    ).toBeNull();
  });

  it('keeps the engine and algorithm only when they differ from the defaults', () => {
    const view = { ...DEFAULT_CHARTS_STATE, engine: 'js', algorithm: 'lttb' } as const;
    const params = toSearchParams(view);
    expect(params.toString()).toBe('engine=js&algo=lttb');
    expect(fromSearchParams(params)).toEqual(view);
  });

  it('ignores unknown engines and algorithms', () => {
    expect(fromSearchParams(new URLSearchParams('engine=gpu&algo=magic'))).toEqual(
      DEFAULT_CHARTS_STATE,
    );
  });
});
