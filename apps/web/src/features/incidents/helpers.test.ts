import { describe, expect, it } from 'vitest';
import { getAssets } from '../../store/assets';
import { fromLocalInput, toLocalInput } from './dates';
import { isSafeLink } from './editor/links';
import { MAX_SUGGESTIONS, suggestAssets } from './editor/suggestions';
import { findMatches, stepMatch } from './pdf/search';
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  viewerFromSearchParams,
  viewerToSearchParams,
} from './url';

describe('suggestAssets', () => {
  const assets = getAssets();

  it('lists substations for an empty query', () => {
    const list = suggestAssets(assets, '');
    expect(list).toHaveLength(MAX_SUGGESTIONS);
    expect(list.every((asset) => asset.kind === 'substation')).toBe(true);
  });

  it('ranks name prefixes first, then ids, then words, then substrings', () => {
    expect(suggestAssets(assets, 'cst-001')[0].name).toBe('CST-001 138 kV');
    expect(suggestAssets(assets, 'ln-0001')[0].id).toBe('ln-0001');
    expect(suggestAssets(assets, 'gas').every((asset) => /gas/i.test(asset.name))).toBe(true);
    expect(suggestAssets(assets, 'zzz-none')).toEqual([]);
  });
});

describe('PDF search', () => {
  const pages = [
    ['Relay event record', 'Breaker CB-112 open'],
    ['Fault values', 'breaker reclose'],
  ];

  it('finds every item containing the query, ignoring case', () => {
    expect(findMatches(pages, 'BREAKER')).toEqual([
      { page: 1, item: 1 },
      { page: 2, item: 1 },
    ]);
    expect(findMatches(pages, 'b')).toEqual([]);
  });

  it('steps through matches, wrapping around', () => {
    expect(stepMatch(3, 2, 1)).toBe(0);
    expect(stepMatch(3, 0, -1)).toBe(2);
    expect(stepMatch(3, -1, -1)).toBe(2);
    expect(stepMatch(0, -1, 1)).toBe(-1);
  });
});

describe('links', () => {
  it('allows only http, https and mailto', () => {
    expect(isSafeLink('https://www.ercot.com')).toBe(true);
    expect(isSafeLink('mailto:ops@example.com')).toBe(true);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink('data:text/html,hi')).toBe(false);
    expect(isSafeLink('www.example.com')).toBe(false);
  });
});

describe('dates', () => {
  it('round-trips a datetime-local value', () => {
    const time = new Date(2026, 8, 14, 14, 2).getTime();
    expect(toLocalInput(time)).toBe('2026-09-14T14:02');
    expect(fromLocalInput('2026-09-14T14:02')).toBe(time);
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('not a date')).toBeNull();
  });
});

describe('URL state', () => {
  it('keeps list filters, leaving out the defaults', () => {
    expect(filtersToSearchParams({ status: 'all', query: ' ' }).toString()).toBe('');
    const params = filtersToSearchParams({ status: 'open', query: 'trip' });
    expect(params.toString()).toBe('status=open&q=trip');
    expect(filtersFromSearchParams(params)).toEqual({ status: 'open', query: 'trip' });
    expect(filtersFromSearchParams(new URLSearchParams('status=bogus'))).toEqual({
      status: 'all',
      query: '',
    });
  });

  it('keeps the open document and page', () => {
    const params = viewerToSearchParams({ doc: 'att-sample-relay', page: 2 });
    expect(params.toString()).toBe('doc=att-sample-relay&page=2');
    expect(viewerFromSearchParams(params)).toEqual({ doc: 'att-sample-relay', page: 2 });
    expect(viewerToSearchParams({ doc: 'att-sample-relay', page: 1 }).toString()).toBe(
      'doc=att-sample-relay',
    );
    expect(viewerFromSearchParams(new URLSearchParams('doc=../etc&page=3'))).toEqual({
      doc: null,
      page: 1,
    });
    expect(viewerFromSearchParams(new URLSearchParams('doc=att-1&page=-4'))).toEqual({
      doc: 'att-1',
      page: 1,
    });
  });
});
