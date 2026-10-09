import { MAP_LAYERS, type MapLayer } from './geo';

/** Search params this view owns; the rest of the URL (e.g. `asset`) is kept. */
export const SEARCH_KEYS = ['layers'] as const;

/** Visible layers → `layers=lines,substations`, left out when every layer is shown. */
export const toSearchParams = (layers: readonly MapLayer[]): URLSearchParams => {
  const params = new URLSearchParams();
  if (layers.length !== MAP_LAYERS.length) params.set('layers', layers.join(','));
  return params;
};

/** `layers` → visible layers; absent means all, unknown names are dropped. */
export const fromSearchParams = (params: URLSearchParams): MapLayer[] => {
  const value = params.get('layers');
  if (value === null) return [...MAP_LAYERS];
  const wanted = new Set(value.split(','));
  return MAP_LAYERS.filter((layer) => wanted.has(layer));
};
