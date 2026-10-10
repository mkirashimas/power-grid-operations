import type { UnknownAction } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeStore, type RootState } from '../store';
import { setSeverity } from './alarms/slice';
import { useAlarmsUrlSync } from './alarms/hooks/useAlarmsUrlSync';
import { setEngine } from './charts/slice';
import { useChartsUrlSync } from './charts/hooks/useChartsUrlSync';
import { setStatusFilter } from './incidents/slice';
import { useIncidentListUrlSync } from './incidents/hooks/useIncidentListUrlSync';
import { setLayerVisible } from './map/slice';
import { useMapUrlSync } from './map/hooks/useMapUrlSync';
import { applyEdit } from './network/slice';
import { useNetworkUrlSync } from './network/hooks/useNetworkUrlSync';
import { setFilter } from './telemetry/slice';
import { useQueryUrlSync } from './telemetry/hooks/useQueryUrlSync';

// The hooks read the URL through Next.js; here it is the jsdom location.
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

interface Case {
  name: string;
  hook: () => void;
  /** A shared link to open. */
  search: string;
  restored: (state: RootState) => unknown;
  expected: unknown;
  /** A change made after the page opened, and the URL it should produce. */
  change: UnknownAction;
  url: RegExp;
}

// Every view mirrors its own keys and keeps the rest of the URL (here `asset`).
const CASES: Case[] = [
  {
    name: 'alarms',
    hook: useAlarmsUrlSync,
    search: '?asset=sub-cst-001&zone=coast',
    restored: (state) => state.alarms?.zone,
    expected: 'coast',
    change: setSeverity('alarm'),
    url: /^\?asset=sub-cst-001&severity=alarm&zone=coast$/,
  },
  {
    name: 'charts',
    hook: useChartsUrlSync,
    search: '?asset=sub-cst-001&algo=lttb',
    restored: (state) => state.charts?.algorithm,
    expected: 'lttb',
    change: setEngine('js'),
    url: /asset=sub-cst-001.*engine=js/,
  },
  {
    name: 'incidents',
    hook: useIncidentListUrlSync,
    search: '?asset=sub-cst-001&q=breaker',
    restored: (state) => state.incidents?.query,
    expected: 'breaker',
    change: setStatusFilter('open'),
    url: /^\?asset=sub-cst-001&status=open&q=breaker$/,
  },
  {
    name: 'map',
    hook: useMapUrlSync,
    search: '?asset=sub-cst-001&layers=lines,substations',
    restored: (state) => state.map?.layers,
    expected: ['lines', 'substations'],
    change: setLayerVisible({ layer: 'lines', visible: false }),
    url: /^\?asset=sub-cst-001&layers=substations$/,
  },
  {
    name: 'network',
    hook: useNetworkUrlSync,
    search: '?asset=ln-0001&zone=coast',
    restored: (state) => state.network?.zone,
    expected: 'coast',
    change: applyEdit({ type: 'trip', assetId: 'ln-0001' }),
    url: /^\?asset=ln-0001&mode=study&zone=coast&study=t\.ln-0001$/,
  },
  {
    name: 'telemetry',
    hook: useQueryUrlSync,
    search: '?asset=sub-cst-001&zone=coast',
    restored: (state) => state.telemetry?.filters.zone,
    expected: 'coast',
    change: setFilter({ key: 'kind', value: 'line' }),
    url: /asset=sub-cst-001.*kind=line/,
  },
];

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe.each(CASES)('$name URL sync', ({ hook, search, restored, expected, change, url }) => {
  const mount = () => {
    window.history.replaceState(null, '', `/view${search}`);
    const store = makeStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    renderHook(hook, { wrapper });
    return store;
  };

  it('restores the view from a shared link without rewriting it', () => {
    const store = mount();
    expect(restored(store.getState())).toEqual(expected);
    // The same parameters (a rewrite may percent-encode them, e.g. `,` as `%2C`).
    expect(new URLSearchParams(window.location.search).toString()).toBe(
      new URLSearchParams(search).toString(),
    );
  });

  it('mirrors later changes, keeping the keys other views own', () => {
    const store = mount();
    act(() => {
      store.dispatch(change);
    });
    expect(window.location.search).toMatch(url);
  });
});
