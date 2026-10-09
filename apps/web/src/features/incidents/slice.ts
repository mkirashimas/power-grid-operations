import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';
import type { StatusFilter } from './model';

export interface IncidentFilters {
  status: StatusFilter;
  query: string;
}

export const DEFAULT_FILTERS: IncidentFilters = { status: 'all', query: '' };

/** Filters of the incident list, mirrored in the URL. The reports themselves are in RTK Query. */
const incidentsSlice = createSlice({
  name: 'incidents',
  initialState: DEFAULT_FILTERS,
  reducers: {
    setStatusFilter: (state, action: PayloadAction<StatusFilter>) => {
      state.status = action.payload;
    },
    setQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    restoreFilters: (_state, action: PayloadAction<IncidentFilters>) => action.payload,
  },
  selectors: {
    selectIncidentFilters: (state) => state,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof incidentsSlice> {}
}

const injected = incidentsSlice.injectInto(rootReducer);

export const { setStatusFilter, setQuery, restoreFilters } = incidentsSlice.actions;
export const { selectIncidentFilters } = injected.selectors;
