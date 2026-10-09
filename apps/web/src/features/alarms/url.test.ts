import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from './slice';
import { fromSearchParams, toSearchParams } from './url';

describe('alarms URL state', () => {
  it('round-trips the filters and leaves out defaults', () => {
    const filters = { severity: 'alarm', zone: 'far-west' } as const;
    const params = toSearchParams(filters);
    expect(params.toString()).toBe('severity=alarm&zone=far-west');
    expect(fromSearchParams(params)).toEqual(filters);
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('falls back to the defaults for unknown values', () => {
    expect(fromSearchParams(new URLSearchParams('severity=panic&zone=mars'))).toEqual(
      DEFAULT_FILTERS,
    );
  });
});
