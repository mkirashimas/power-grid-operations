import type { WeatherZone } from '@pgo/grid-model';
import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';
import type { StudyEdit } from './engine/study';

/** Edge colours from the realtime feed, or from the what-if study. */
export type NetworkMode = 'live' | 'study';
export type ZoneScope = 'all' | WeatherZone;

export interface NetworkState {
  mode: NetworkMode;
  zone: ZoneScope;
  edits: StudyEdit[];
}

export const DEFAULT_NETWORK_STATE: NetworkState = { mode: 'live', zone: 'all', edits: [] };

const sameTarget = (a: StudyEdit, b: StudyEdit) => a.type === b.type && a.assetId === b.assetId;

/** UI state of the network view, mirrored in the URL (`mode`, `zone`, `study`). */
const networkSlice = createSlice({
  name: 'network',
  initialState: DEFAULT_NETWORK_STATE,
  reducers: {
    setMode: (state, action: PayloadAction<NetworkMode>) => {
      state.mode = action.payload;
    },
    setZone: (state, action: PayloadAction<ZoneScope>) => {
      state.zone = action.payload;
    },
    /** Adds an edit, replacing one for the same asset and type; a 0 % load change removes it. */
    applyEdit: (state, action: PayloadAction<StudyEdit>) => {
      const edit = action.payload;
      state.edits = state.edits.filter((existing) => !sameTarget(existing, edit));
      if (!(edit.type === 'load' && edit.percent === 0)) state.edits.push(edit);
      state.mode = 'study';
    },
    removeEdit: (state, action: PayloadAction<StudyEdit>) => {
      state.edits = state.edits.filter((existing) => !sameTarget(existing, action.payload));
    },
    clearEdits: (state) => {
      state.edits = [];
    },
    restoreNetwork: (_state, action: PayloadAction<NetworkState>) => action.payload,
  },
  selectors: {
    selectNetwork: (state) => state,
    selectEdits: (state) => state.edits,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof networkSlice> {}
}

const injected = networkSlice.injectInto(rootReducer);

export const { setMode, setZone, applyEdit, removeEdit, clearEdits, restoreNetwork } =
  networkSlice.actions;
export const { selectNetwork, selectEdits } = injected.selectors;
