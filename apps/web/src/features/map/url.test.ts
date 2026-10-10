import { describe, expect, it } from 'vitest';
import { MAP_LAYERS } from './geo';
import { fromSearchParams, toSearchParams } from './url';

describe('map URL state', () => {
  it('omits the default (every layer) and round-trips a subset', () => {
    expect(toSearchParams(MAP_LAYERS).toString()).toBe('');
    const params = toSearchParams(['lines', 'substations']);
    expect(params.toString()).toBe('layers=lines%2Csubstations');
    expect(fromSearchParams(params)).toEqual(['lines', 'substations']);
  });

  it('keeps layer order, drops unknown names, and allows an empty map', () => {
    expect(fromSearchParams(new URLSearchParams('layers=substations,boats,lines'))).toEqual([
      'lines',
      'substations',
    ]);
    expect(fromSearchParams(new URLSearchParams('layers='))).toEqual([]);
    expect(fromSearchParams(new URLSearchParams(''))).toEqual([...MAP_LAYERS]);
  });
});
