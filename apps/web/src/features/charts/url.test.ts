import { describe, expect, it } from 'vitest';
import { fromSearchParams, toSearchParams } from './url';

describe('charts URL state', () => {
  it('round-trips a range at minute precision', () => {
    const domain: [number, number] = [Date.UTC(2026, 9, 1, 5), Date.UTC(2026, 9, 8, 5, 30)];
    const params = toSearchParams(domain);
    expect(params.toString()).toBe('from=2026-10-01T05%3A00Z&to=2026-10-08T05%3A30Z');
    expect(fromSearchParams(params)).toEqual(domain);
  });

  it('treats a missing, invalid or reversed range as the default', () => {
    expect(toSearchParams(null).toString()).toBe('');
    expect(fromSearchParams(new URLSearchParams(''))).toBeNull();
    expect(fromSearchParams(new URLSearchParams('from=yesterday&to=today'))).toBeNull();
    expect(
      fromSearchParams(new URLSearchParams('from=2026-10-08T00:00Z&to=2026-10-01T00:00Z')),
    ).toBeNull();
  });
});
