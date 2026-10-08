import { describe, expect, it } from 'vitest';
import { generateAssets } from './assets.ts';
import { WEATHER_ZONES } from './types.ts';
import { ZONES } from './zones.ts';

const assets = generateAssets();
const ofKind = (kind: string) => assets.filter((asset) => asset.kind === kind);

describe('generateAssets', () => {
  it('is deterministic for a seed', () => {
    expect(generateAssets()).toEqual(assets);
    expect(generateAssets({ seed: 1 })).not.toEqual(assets);
  });

  it('creates about 2,000 assets of every kind', () => {
    expect(assets.length).toBeGreaterThanOrEqual(1800);
    expect(assets.length).toBeLessThanOrEqual(2200);
    expect(ofKind('substation')).toHaveLength(400);
    expect(ofKind('load')).toHaveLength(400);
    expect(ofKind('generator')).toHaveLength(300);
    expect(ofKind('line').length).toBeGreaterThan(400);
  });

  it('gives every asset a unique id and its position as index', () => {
    expect(new Set(assets.map((asset) => asset.id)).size).toBe(assets.length);
    assets.forEach((asset, index) => expect(asset.index).toBe(index));
  });

  it('places assets inside their zone and covers every zone', () => {
    ofKind('substation').forEach((asset) => {
      const { lat, lon } = ZONES[asset.zone];
      expect(asset.lat).toBeGreaterThanOrEqual(lat[0]);
      expect(asset.lat).toBeLessThanOrEqual(lat[1]);
      expect(asset.lon).toBeGreaterThanOrEqual(lon[0]);
      expect(asset.lon).toBeLessThanOrEqual(lon[1]);
    });
    expect(new Set(ofKind('substation').map((asset) => asset.zone))).toEqual(
      new Set(WEATHER_ZONES),
    );
  });

  it('attaches loads and generators to existing substations', () => {
    const substationIds = new Set(ofKind('substation').map((asset) => asset.id));
    [...ofKind('load'), ...ofKind('generator')].forEach((asset) => {
      expect(substationIds.has(asset.substationId!)).toBe(true);
    });
    expect(ofKind('generator').filter((asset) => asset.fuel === 'nuclear')).toHaveLength(2);
  });

  it('builds one connected network of lines between existing substations', () => {
    const substations = ofKind('substation');
    const neighbours = new Map(substations.map((s) => [s.id, new Set<string>()]));
    ofKind('line').forEach((line) => {
      expect(neighbours.has(line.substationId!)).toBe(true);
      expect(neighbours.has(line.toSubstationId!)).toBe(true);
      expect(line.substationId).not.toBe(line.toSubstationId);
      neighbours.get(line.substationId!)!.add(line.toSubstationId!);
      neighbours.get(line.toSubstationId!)!.add(line.substationId!);
    });

    const seen = new Set([substations[0].id]);
    const queue = [substations[0].id];
    while (queue.length > 0) {
      neighbours.get(queue.shift()!)!.forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    expect(seen.size).toBe(substations.length);
  });

  it('rates every asset', () => {
    assets.forEach((asset) => expect(asset.capacityMw).toBeGreaterThan(0));
  });
});
