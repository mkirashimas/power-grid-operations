import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';
import type { SeverityFilter, ZoneFilter } from './live';

export interface AlarmFilters {
  severity: SeverityFilter;
  zone: ZoneFilter;
}

export const DEFAULT_FILTERS: AlarmFilters = { severity: 'all', zone: 'all' };

/** Filters of the alarm table, mirrored in the URL. Live data itself is in RTK Query. */
const alarmsSlice = createSlice({
  name: 'alarms',
  initialState: DEFAULT_FILTERS,
  reducers: {
    setSeverity: (state, action: PayloadAction<SeverityFilter>) => {
      state.severity = action.payload;
    },
    setZone: (state, action: PayloadAction<ZoneFilter>) => {
      state.zone = action.payload;
    },
    restoreFilters: (_state, action: PayloadAction<AlarmFilters>) => action.payload,
  },
  selectors: {
    selectFilters: (state) => state,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof alarmsSlice> {}
}

const injected = alarmsSlice.injectInto(rootReducer);

export const { setSeverity, setZone, restoreFilters } = alarmsSlice.actions;
export const { selectFilters } = injected.selectors;
