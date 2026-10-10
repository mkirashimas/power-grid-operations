import { combineSlices, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { api } from './api';
import { shellSlice } from './shellSlice';

/**
 * Feature slices register themselves (slice.injectInto(rootReducer)) and extend this
 * interface, so the store never imports features.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LazyLoadedSlices {}

export const rootReducer = combineSlices(api, shellSlice).withLazyLoadedSlices<LazyLoadedSlices>();

/**
 * A new store per request on the server and once per page load in the browser (see hoc/Providers).
 * `preloadedState` carries what the server read from cookies, e.g. the sidebar choice.
 */
export const makeStore = (preloadedState?: Partial<ReturnType<typeof rootReducer>>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
  });
  setupListeners(store.dispatch);
  return store;
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
