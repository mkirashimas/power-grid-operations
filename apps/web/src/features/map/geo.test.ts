import { generateAssets } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { assetSeverity, TEXAS_BOUNDS, toGeoJson } from './geo';

describe('toGeoJson', () => {
  const assets = generateAssets();
  const geo = toGeoJson(assets);
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  it('has one feature per asset, in the layer of its kind', () => {
    expect(geo.lines.features).toHaveLength(769);
    expect(geo.substations.features).toHaveLength(400);
    expect(geo.generators.features).toHaveLength(300);
    expect(geo.loads.features).toHaveLength(400);
  });

  it('uses the asset index as feature id', () => {
    const feature = geo.generators.features[10];
    expect(assets[feature.id as number].id).toBe(feature.properties.id);
    expect(assets[feature.id as number].kind).toBe('generator');
  });

  it('draws each line between its two substations', () => {
    geo.lines.features.slice(0, 50).forEach((line) => {
      const asset = byId.get(line.properties.id)!;
      const from = byId.get(asset.substationId!)!;
      const to = byId.get(asset.toSubstationId!)!;
      expect(line.geometry.coordinates).toEqual([
        [from.lon, from.lat],
        [to.lon, to.lat],
      ]);
    });
  });

  it('keeps every point inside the Texas bounds', () => {
    const [[west, south], [east, north]] = TEXAS_BOUNDS;
    [...geo.substations.features, ...geo.generators.features, ...geo.loads.features].forEach(
      ({
        geometry: {
          coordinates: [lon, lat],
        },
      }) => {
        expect(lon).toBeGreaterThan(west);
        expect(lon).toBeLessThan(east);
        expect(lat).toBeGreaterThan(south);
        expect(lat).toBeLessThan(north);
      },
    );
  });
});

describe('assetSeverity', () => {
  it('uses the telemetry thresholds', () => {
    expect(assetSeverity(50, 1)).toBe(0);
    expect(assetSeverity(92, 1)).toBe(1);
    expect(assetSeverity(101, 1)).toBe(2);
    expect(assetSeverity(50, 0.93)).toBe(2);
    expect(assetSeverity(undefined, undefined)).toBe(0);
  });
});
