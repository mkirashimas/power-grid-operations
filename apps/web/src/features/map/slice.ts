import { createSlice, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';
import { rootReducer } from '../../store';
import { MAP_LAYERS, type MapLayer } from './geo';

export interface MapState {
  /** Layers shown on the map, in `MAP_LAYERS` order. */
  layers: MapLayer[];
}

export const DEFAULT_LAYERS: MapLayer[] = [...MAP_LAYERS];

/** UI state of the map; mirrored in the URL. Live data is in the shared live feed. */
const mapSlice = createSlice({
  name: 'map',
  initialState: { layers: DEFAULT_LAYERS } as MapState,
  reducers: {
    setLayerVisible: (state, action: PayloadAction<{ layer: MapLayer; visible: boolean }>) => {
      const { layer, visible } = action.payload;
      const next = new Set(state.layers);
      if (visible) next.add(layer);
      else next.delete(layer);
      state.layers = MAP_LAYERS.filter((item) => next.has(item));
    },
    restoreLayers: (state, action: PayloadAction<MapLayer[]>) => {
      state.layers = action.payload;
    },
  },
  selectors: {
    selectLayers: (state) => state.layers,
  },
});

// Adds this slice to RootState (RTK's lazy-slice pattern; the interface is meant to be empty).
declare module '../../store' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface LazyLoadedSlices extends WithSlice<typeof mapSlice> {}
}

const injected = mapSlice.injectInto(rootReducer);

export const { setLayerVisible, restoreLayers } = mapSlice.actions;
export const { selectLayers } = injected.selectors;
