import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../store';
import { useMessageRate } from './alarms/hooks/useMessageRate';
import { restoreLayers, selectLayers, setLayerVisible } from './map/slice';
import { applyEdit, clearEdits, removeEdit, selectNetwork, setMode } from './network/slice';
import {
  DEFAULT_QUERY,
  resetFilters,
  selectQuery,
  setFilter,
  setGroupBy,
  setGroupExpanded,
} from './telemetry/slice';

describe('map slice', () => {
  it('keeps layers in drawing order, whatever order they are toggled in', () => {
    const store = makeStore();
    store.dispatch(restoreLayers(['substations']));
    store.dispatch(setLayerVisible({ layer: 'lines', visible: true }));
    expect(selectLayers(store.getState())).toEqual(['lines', 'substations']);
    store.dispatch(setLayerVisible({ layer: 'substations', visible: false }));
    expect(selectLayers(store.getState())).toEqual(['lines']);
  });
});

describe('network slice', () => {
  it('replaces an edit for the same asset and switches to the study', () => {
    const store = makeStore();
    store.dispatch(applyEdit({ type: 'load', assetId: 'sub-cst-001', percent: 20 }));
    store.dispatch(applyEdit({ type: 'load', assetId: 'sub-cst-001', percent: -10 }));
    store.dispatch(applyEdit({ type: 'trip', assetId: 'ln-0001' }));
    const { mode, edits } = selectNetwork(store.getState());
    expect(mode).toBe('study');
    expect(edits).toEqual([
      { type: 'load', assetId: 'sub-cst-001', percent: -10 },
      { type: 'trip', assetId: 'ln-0001' },
    ]);
  });

  it('drops a 0 % load change, and removes or clears edits', () => {
    const store = makeStore();
    store.dispatch(applyEdit({ type: 'load', assetId: 'sub-cst-001', percent: 20 }));
    store.dispatch(applyEdit({ type: 'load', assetId: 'sub-cst-001', percent: 0 }));
    expect(selectNetwork(store.getState()).edits).toEqual([]);

    store.dispatch(applyEdit({ type: 'trip', assetId: 'ln-0001' }));
    store.dispatch(applyEdit({ type: 'offline', assetId: 'gen-cst-003' }));
    store.dispatch(removeEdit({ type: 'trip', assetId: 'ln-0001' }));
    expect(selectNetwork(store.getState()).edits).toEqual([
      { type: 'offline', assetId: 'gen-cst-003' },
    ]);
    store.dispatch(clearEdits());
    store.dispatch(setMode('live'));
    expect(selectNetwork(store.getState())).toMatchObject({ mode: 'live', edits: [] });
  });
});

describe('telemetry slice', () => {
  it('changing the grouping collapses every group', () => {
    const store = makeStore();
    store.dispatch(setGroupBy('zone'));
    store.dispatch(setGroupExpanded({ key: 'coast', expanded: true }));
    store.dispatch(setGroupExpanded({ key: 'coast', expanded: true }));
    store.dispatch(setGroupExpanded({ key: 'east', expanded: true }));
    expect(selectQuery(store.getState()).expanded).toEqual(['coast', 'east']);
    store.dispatch(setGroupExpanded({ key: 'coast', expanded: false }));
    expect(selectQuery(store.getState()).expanded).toEqual(['east']);
    store.dispatch(setGroupBy('kind'));
    expect(selectQuery(store.getState()).expanded).toEqual([]);
  });

  it('resets the filters only', () => {
    const store = makeStore();
    store.dispatch(setFilter({ key: 'zone', value: 'coast' }));
    store.dispatch(setGroupBy('zone'));
    store.dispatch(resetFilters());
    expect(selectQuery(store.getState())).toMatchObject({
      filters: DEFAULT_QUERY.filters,
      groupBy: 'zone',
    });
  });
});

describe('useMessageRate', () => {
  afterEach(() => vi.useRealTimers());

  it('averages messages per second over the window', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ count }) => useMessageRate(count, 5000), {
      initialProps: { count: 0 },
    });
    expect(result.current).toBe(0);
    // 10 messages a second for 3 seconds.
    for (let second = 1; second <= 3; second += 1) {
      rerender({ count: second * 10 });
      act(() => vi.advanceTimersByTime(1000));
    }
    expect(result.current).toBeCloseTo(10, 5);
  });
});
