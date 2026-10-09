import type { Algorithm, Engine } from '@pgo/downsample';
import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';

export interface ChartsState {
  /** Visible range in epoch ms; null shows the default (the last 7 days). */
  domain: [number, number] | null;
  /** Downsampling of the 1-second series: JS or Rust/WASM. */
  engine: Engine;
  algorithm: Algorithm;
}

export const DEFAULT_CHARTS_STATE: ChartsState = {
  domain: null,
  engine: 'wasm',
  algorithm: 'minmax',
};

/** UI state of the chart workbench. Mirrored in the URL. */
const chartsSlice = createSlice({
  name: 'charts',
  initialState: DEFAULT_CHARTS_STATE,
  reducers: {
    setDomain: (state, action: PayloadAction<[number, number] | null>) => {
      state.domain = action.payload;
    },
    setEngine: (state, action: PayloadAction<Engine>) => {
      state.engine = action.payload;
    },
    setAlgorithm: (state, action: PayloadAction<Algorithm>) => {
      state.algorithm = action.payload;
    },
    /** Replaces the whole view, e.g. from the URL when the page opens. */
    restoreView: (_state, action: PayloadAction<ChartsState>) => action.payload,
  },
  selectors: {
    selectDomain: (state) => state.domain,
    selectEngine: (state) => state.engine,
    selectAlgorithm: (state) => state.algorithm,
    selectChartsView: (state) => state,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof chartsSlice> {}
}

const injected = chartsSlice.injectInto(rootReducer);

export const { setDomain, setEngine, setAlgorithm, restoreView } = chartsSlice.actions;
export const { selectDomain, selectEngine, selectAlgorithm, selectChartsView } = injected.selectors;
