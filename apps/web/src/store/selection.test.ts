import { describe, expect, it } from 'vitest';
import { makeStore } from './index';
import { findAsset } from './assets';
import { clearSelection, selectAsset, selectSelectedAssetId } from './selectionSlice';
import { mergeSearch } from './url';

describe('selection slice', () => {
  it('selects and clears one asset', () => {
    const store = makeStore();
    expect(selectSelectedAssetId(store.getState())).toBeNull();
    store.dispatch(selectAsset('sub-cst-012'));
    expect(selectSelectedAssetId(store.getState())).toBe('sub-cst-012');
    store.dispatch(clearSelection());
    expect(selectSelectedAssetId(store.getState())).toBeNull();
  });
});

describe('findAsset', () => {
  it('looks up the synthetic grid by id', () => {
    expect(findAsset('sub-cst-001')).toMatchObject({ id: 'sub-cst-001', kind: 'substation' });
    expect(findAsset('ln-0001')?.kind).toBe('line');
    expect(findAsset('nope')).toBeUndefined();
    expect(findAsset(null)).toBeUndefined();
  });
});

describe('mergeSearch', () => {
  it("replaces only the owner's keys and keeps the others", () => {
    expect(
      mergeSearch('asset=sub-cst-001&from=a&to=b', ['from', 'to'], new URLSearchParams('from=c')),
    ).toBe('asset=sub-cst-001&from=c');
    expect(mergeSearch('q=gen&asset=x', ['asset'], new URLSearchParams())).toBe('q=gen');
    expect(mergeSearch('', ['asset'], new URLSearchParams('asset=y'))).toBe('asset=y');
  });
});
