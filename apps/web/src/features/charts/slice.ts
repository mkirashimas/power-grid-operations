import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';

export interface ChartsState {
  /** Visible range in epoch ms; null shows the default (the last 7 days). */
  domain: [number, number] | null;
}

const initialState: ChartsState = { domain: null };

/** UI state of the chart workbench. Mirrored in the URL. */
const chartsSlice = createSlice({
  name: 'charts',
  initialState,
  reducers: {
    setDomain: (state, action: PayloadAction<[number, number] | null>) => {
      state.domain = action.payload;
    },
  },
  selectors: {
    selectDomain: (state) => state.domain,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof chartsSlice> {}
}

const injected = chartsSlice.injectInto(rootReducer);

export const { setDomain } = chartsSlice.actions;
export const { selectDomain } = injected.selectors;
