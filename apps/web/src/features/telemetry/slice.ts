import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';
import type { GroupBy, SortKey, TelemetryFilters, TelemetryQuery } from './engine/types';

export const DEFAULT_QUERY: TelemetryQuery = {
  filters: { text: '', kind: 'all', zone: 'all', status: 'all' },
  sort: [],
  groupBy: 'none',
  expanded: [],
};

/** UI state of the telemetry view: the query the worker runs. Mirrored in the URL. */
const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState: DEFAULT_QUERY,
  reducers: {
    setFilter: <K extends keyof TelemetryFilters>(
      state: TelemetryQuery,
      action: PayloadAction<{ key: K; value: TelemetryFilters[K] }>,
    ) => {
      state.filters[action.payload.key] = action.payload.value;
    },
    resetFilters: (state) => {
      state.filters = DEFAULT_QUERY.filters;
    },
    setSort: (state, action: PayloadAction<SortKey[]>) => {
      state.sort = action.payload;
    },
    setGroupBy: (state, action: PayloadAction<GroupBy>) => {
      state.groupBy = action.payload;
      state.expanded = [];
    },
    setGroupExpanded: (state, action: PayloadAction<{ key: string; expanded: boolean }>) => {
      const { key, expanded } = action.payload;
      state.expanded = expanded
        ? [...new Set([...state.expanded, key])]
        : state.expanded.filter((k) => k !== key);
    },
    setExpanded: (state, action: PayloadAction<string[]>) => {
      state.expanded = action.payload;
    },
    replaceQuery: (_, action: PayloadAction<TelemetryQuery>) => action.payload,
  },
  selectors: {
    selectQuery: (state) => state,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof telemetrySlice> {}
}

const injected = telemetrySlice.injectInto(rootReducer);

export const {
  setFilter,
  resetFilters,
  setSort,
  setGroupBy,
  setGroupExpanded,
  setExpanded,
  replaceQuery,
} = telemetrySlice.actions;

export const { selectQuery } = injected.selectors;
