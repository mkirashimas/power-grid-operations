import { statusOf, statusSeverity, type Asset, type AssetKind } from '@pgo/grid-model';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

/** Map layers, one per asset kind, drawn bottom to top. */
export const MAP_LAYERS = ['lines', 'loads', 'generators', 'substations'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

export const LAYER_OF_KIND: Record<AssetKind, MapLayer> = {
  line: 'lines',
  substation: 'substations',
  generator: 'generators',
  load: 'loads',
};

/** Texas, with a margin: [[west, south], [east, north]]. */
export const TEXAS_BOUNDS: [[number, number], [number, number]] = [
  [-107, 25.5],
  [-93, 36.8],
];

export interface AssetProperties {
  id: string;
  name: string;
}

export type AssetGeoJson = {
  lines: FeatureCollection<LineString, AssetProperties>;
} & Record<Exclude<MapLayer, 'lines'>, FeatureCollection<Point, AssetProperties>>;

const collection = <G extends Point | LineString>(
  features: Feature<G, AssetProperties>[],
): FeatureCollection<G, AssetProperties> => ({ type: 'FeatureCollection', features });

/**
 * The grid as GeoJSON, one collection per layer. Feature ids are asset indexes, so live values
 * (indexed the same way) map straight onto MapLibre feature-state. Lines run between their two
 * substations.
 */
export const toGeoJson = (assets: readonly Asset[]): AssetGeoJson => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const points: Record<Exclude<MapLayer, 'lines'>, Feature<Point, AssetProperties>[]> = {
    substations: [],
    generators: [],
    loads: [],
  };
  const lines: Feature<LineString, AssetProperties>[] = [];

  assets.forEach((asset) => {
    const properties = { id: asset.id, name: asset.name };
    if (asset.kind === 'line') {
      const from = byId.get(asset.substationId ?? '');
      const to = byId.get(asset.toSubstationId ?? '');
      if (!from || !to) return;
      lines.push({
        type: 'Feature',
        id: asset.index,
        properties,
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.lon, from.lat],
            [to.lon, to.lat],
          ],
        },
      });
      return;
    }
    const layer = LAYER_OF_KIND[asset.kind] as Exclude<MapLayer, 'lines'>;
    points[layer].push({
      type: 'Feature',
      id: asset.index,
      properties,
      geometry: { type: 'Point', coordinates: [asset.lon, asset.lat] },
    });
  });

  return {
    lines: collection(lines),
    substations: collection(points.substations),
    generators: collection(points.generators),
    loads: collection(points.loads),
  };
};

/** 0 normal, 1 warning, 2 alarm, from live loading and voltage (the telemetry thresholds). */
export const assetSeverity = (loadingPct: number | undefined, voltagePu: number | undefined) =>
  loadingPct === undefined || voltagePu === undefined
    ? 0
    : statusSeverity(statusOf(loadingPct, voltagePu));
