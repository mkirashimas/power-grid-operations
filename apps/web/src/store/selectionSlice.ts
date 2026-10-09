import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from './index';

export interface SelectionState {
  /** Id of the selected synthetic asset (e.g. "sub-cst-012"), or null. */
  assetId: string | null;
}

/**
 * The linked selection: one asset, shared by every view and mirrored in the URL as `asset`
 * (hoc/useSelectionUrlSync). Cross-feature state, so it lives here and not in a feature.
 */
const selectionSlice = createSlice({
  name: 'selection',
  initialState: { assetId: null } as SelectionState,
  reducers: {
    selectAsset: (state, action: PayloadAction<string>) => {
      state.assetId = action.payload;
    },
    clearSelection: (state) => {
      state.assetId = null;
    },
  },
  selectors: {
    selectSelectedAssetId: (state) => state.assetId,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module './index' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof selectionSlice> {}
}

const injected = selectionSlice.injectInto(rootReducer);

export const { selectAsset, clearSelection } = selectionSlice.actions;
export const { selectSelectedAssetId } = injected.selectors;
