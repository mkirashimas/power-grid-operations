'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { Asset } from '@pgo/grid-model';
import { Box } from '@mui/material';
import { useColorScheme, useTheme } from '@mui/material/styles';
import type {
  ExpressionSpecification,
  FeatureIdentifier,
  Map as MapLibreMap,
  MapGeoJSONFeature,
  PointLike,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import {
  assetSeverity,
  LAYER_OF_KIND,
  MAP_LAYERS,
  TEXAS_BOUNDS,
  type AssetGeoJson,
  type MapLayer,
} from '../geo';

// OpenFreeMap: free vector tiles, no API key. Their attribution is added by the style's source.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;
type Scheme = keyof typeof STYLES;

const layerId = (layer: MapLayer) => `pgo-${layer}`;
const POINT_RADIUS: Record<Exclude<MapLayer, 'lines'>, number> = {
  substations: 4,
  generators: 3.5,
  loads: 2.5,
};

export interface AssetMapProps {
  assets: readonly Asset[];
  geo: AssetGeoJson;
  /** Live values by asset index. */
  loading: readonly number[];
  voltage: readonly number[];
  /** Indexes updated by the latest message. */
  changed: readonly number[];
  layers: readonly MapLayer[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  /** Accessible name of the map canvas, e.g. a summary of the alarms. */
  label: string;
  /** The map could not start, e.g. without WebGL. */
  onError: () => void;
}

/** Theme colours as concrete values: MapLibre cannot read CSS variables. */
const useMapColors = () => {
  const theme = useTheme();
  return (element: Element) => {
    const palette = (theme.vars ?? theme).palette;
    const resolve = (value: string) => {
      const name = /var\((--[^,)]+)/.exec(value)?.[1];
      return (name && getComputedStyle(element).getPropertyValue(name).trim()) || value;
    };
    return {
      normal: resolve(palette.status.normal),
      warning: resolve(palette.status.warning),
      alarm: resolve(palette.status.alarm),
      selected: resolve(palette.primary.main),
      outline: resolve(palette.background.paper),
    };
  };
};

const addAssetLayers = (
  map: MapLibreMap,
  geo: AssetGeoJson,
  colors: ReturnType<ReturnType<typeof useMapColors>>,
) => {
  const status = ['coalesce', ['feature-state', 'status'], 0] as ExpressionSpecification;
  const selected = ['boolean', ['feature-state', 'selected'], false] as ExpressionSpecification;
  const color = [
    'match',
    status,
    2,
    colors.alarm,
    1,
    colors.warning,
    colors.normal,
  ] as ExpressionSpecification;

  MAP_LAYERS.forEach((layer) => {
    const id = layerId(layer);
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: geo[layer] });
    if (map.getLayer(id)) return;
    if (layer === 'lines') {
      map.addLayer({
        id,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['case', selected, colors.selected, color],
          'line-width': ['case', selected, 5, ['match', status, 0, 1.2, 2.5]],
          'line-opacity': ['case', selected, 1, ['match', status, 0, 0.55, 1]],
        },
      });
      return;
    }
    const base = POINT_RADIUS[layer];
    map.addLayer({
      id,
      type: 'circle',
      source: id,
      paint: {
        // Warnings and alarms are drawn larger, so status is not shown by colour alone.
        'circle-radius': ['case', selected, base + 5, ['+', base, ['*', status, 1.5]]],
        'circle-color': color,
        'circle-stroke-color': ['case', selected, colors.selected, colors.outline],
        'circle-stroke-width': ['case', selected, 3, 0.75],
      },
    });
  });
};

/**
 * The grid on an OpenFreeMap base map. MapLibre is loaded on demand (it needs the browser),
 * live values only touch the feature-state of the assets that changed, and a colour-scheme
 * change swaps the base style and re-adds the asset layers.
 */
export const AssetMap = (props: AssetMapProps) => {
  const { assets, loading, voltage, changed, layers, selectedIndex, label } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const loaded = useRef(false);
  const applied = useRef<number | null>(null);
  const colorsOf = useMapColors();
  const { mode, systemMode } = useColorScheme();
  const scheme: Scheme = (mode === 'system' ? systemMode : mode) === 'dark' ? 'dark' : 'light';

  // Latest props and scheme for MapLibre callbacks, which outlive renders.
  const latest = useRef({ props, scheme, colorsOf });
  useEffect(() => {
    latest.current = { props, scheme, colorsOf };
  });

  const featureOf = (index: number): FeatureIdentifier => ({
    source: layerId(LAYER_OF_KIND[latest.current.props.assets[index].kind]),
    id: index,
  });
  const setStatus = (map: MapLibreMap, index: number) => {
    const { loading: l, voltage: v } = latest.current.props;
    map.setFeatureState(featureOf(index), { status: assetSeverity(l[index], v[index]) });
  };
  const select = (map: MapLibreMap, index: number | null) => {
    if (applied.current !== null)
      map.setFeatureState(featureOf(applied.current), { selected: false });
    if (index !== null) map.setFeatureState(featureOf(index), { selected: true });
    applied.current = index;
  };
  const showLayers = (map: MapLibreMap, visible: readonly MapLayer[]) =>
    MAP_LAYERS.forEach((layer) => {
      if (map.getLayer(layerId(layer))) {
        map.setLayoutProperty(
          layerId(layer),
          'visibility',
          visible.includes(layer) ? 'visible' : 'none',
        );
      }
    });

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | undefined;
    import('maplibre-gl')
      .then(({ Map, NavigationControl, AttributionControl, setWorkerUrl }) => {
        // MapLibre looks for its worker next to its own module, which bundling moves; point it
        // at the worker file the bundler emits.
        setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);
        const container = containerRef.current;
        if (cancelled || !container) return;
        // Opened with a selection (e.g. a shared ?asset= link): start centred on it. Read from the
        // URL, because the store may not have the selection yet when the map is created.
        const initialId = new URLSearchParams(window.location.search).get('asset');
        const initial = latest.current.props.assets.find((asset) => asset.id === initialId);
        try {
          map = new Map({
            container,
            style: STYLES[latest.current.scheme],
            ...(initial
              ? { center: [initial.lon, initial.lat] as [number, number], zoom: 7 }
              : { bounds: TEXAS_BOUNDS }),
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
          });
        } catch {
          latest.current.props.onError();
          return;
        }
        const instance = map;
        instance.touchZoomRotate.disableRotation();
        instance.addControl(new AttributionControl({ compact: false }), 'bottom-right');
        instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');

        // Also after every setStyle: the base style replaces our sources and layers.
        instance.on('style.load', () => {
          const { props: current, colorsOf: colors } = latest.current;
          addAssetLayers(instance, current.geo, colors(container));
          showLayers(instance, current.layers);
          current.assets.forEach((_, index) => setStatus(instance, index));
          applied.current = null;
          select(instance, current.selectedIndex);
          instance.getCanvas().setAttribute('aria-label', current.label);
          loaded.current = true;
          // Lets tests (and anything else) wait until the asset layers are drawn.
          instance.once('idle', () => {
            container.dataset.ready = 'true';
          });
        });

        const hits = (point: { x: number; y: number }, tolerance = 5) => {
          const box: [PointLike, PointLike] = [
            [point.x - tolerance, point.y - tolerance],
            [point.x + tolerance, point.y + tolerance],
          ];
          const layerIds = MAP_LAYERS.map(layerId).filter((id) => instance.getLayer(id));
          // Upper layers win (a substation over the lines that end at it), then the point
          // nearest the pointer: assets can sit a few pixels apart, and the result order of
          // queryRenderedFeatures guarantees neither.
          const rank = (id: string) => -layerIds.indexOf(id);
          const distance = (feature: MapGeoJSONFeature) => {
            if (feature.geometry.type !== 'Point') return 0;
            const [lon, lat] = feature.geometry.coordinates;
            const at = instance.project([lon, lat]);
            return Math.hypot(at.x - point.x, at.y - point.y);
          };
          return instance
            .queryRenderedFeatures(box, { layers: layerIds })
            .sort((a, b) => rank(a.layer.id) - rank(b.layer.id) || distance(a) - distance(b));
        };
        instance.on('click', (event) => {
          // A finger covers more than a mouse pointer: search a wider box for taps.
          const original = event.originalEvent as Partial<PointerEvent & TouchEvent>;
          const touch = original.pointerType === 'touch' || original.changedTouches !== undefined;
          const [top] = hits(event.point, touch ? 12 : 5);
          if (top?.id !== undefined) latest.current.props.onSelect(Number(top.id));
        });
        instance.on('mousemove', (event) => {
          instance.getCanvas().style.cursor = hits(event.point).length ? 'pointer' : '';
        });
        mapRef.current = instance;
      })
      .catch(() => latest.current.props.onError());

    return () => {
      cancelled = true;
      loaded.current = false;
      map?.remove();
      mapRef.current = null;
    };
    // Created once; callbacks read the latest props and helpers through `latest` and refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Base style follows the colour scheme.
  const currentScheme = useRef(scheme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentScheme.current === scheme) return;
    currentScheme.current = scheme;
    loaded.current = false;
    map.getContainer().dataset.ready = 'false';
    map.setStyle(STYLES[scheme], { diff: false });
  }, [scheme]);

  // Live values: only the assets that changed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    changed.forEach((index) => {
      if (index < assets.length) setStatus(map, index);
    });
    // setStatus reads the latest values through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, loading, voltage, assets]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current) showLayers(map, layers);
  }, [layers]);

  // Selection: ring it, and fly to it if it is off screen (e.g. selected in a table).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    select(map, selectedIndex);
    if (selectedIndex === null) return;
    const { lon, lat } = assets[selectedIndex];
    if (!map.getBounds().contains([lon, lat])) {
      map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, assets]);

  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute('aria-label', label);
  }, [label]);

  return (
    <Box
      ref={containerRef}
      data-testid="asset-map"
      sx={(theme) => ({
        height: 'min(65vh, 620px)',
        borderRadius: 1,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        [theme.breakpoints.down('sm')]: { height: 420 },
      })}
    />
  );
};
