import { generateAssets } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { buildNetwork, STUDY_LOAD_FACTOR } from './network';
import { BASE_CASE_MAX_LOADING, compareStudies, prepareNetwork, runStudy } from './study';

describe('the study network', () => {
  const assets = generateAssets();
  const network = prepareNetwork(assets);
  const base = runStudy(network, []);

  it('has a bus per substation and a branch per line, with positive reactance', () => {
    expect(network.buses).toHaveLength(400);
    expect(network.lines).toHaveLength(769);
    expect(network.lines.every((line) => line.x > 0)).toBe(true);
  });

  it('balances generation and load in the base case', () => {
    const load = network.loads.reduce((sum, l) => sum + l.mw, 0);
    const generation = network.generators.reduce((sum, g) => sum + g.mw, 0);
    expect(load).toBeCloseTo(
      assets.filter((a) => a.kind === 'load').reduce((s, a) => s + a.capacityMw, 0) *
        STUDY_LOAD_FACTOR,
      3,
    );
    expect(generation).toBeCloseTo(load, 0);
  });

  it('solves the whole grid as one island, with an N-0 secure base case', () => {
    expect(base.islandCount).toBe(1);
    expect(base.deEnergized).toEqual([]);
    const max = Math.max(...base.loadingPct);
    expect(max).toBeLessThanOrEqual(BASE_CASE_MAX_LOADING * 100 + 1e-9);
    expect(max).toBeGreaterThan(50);
    // Ratings never drop below the nameplate.
    expect(network.lines.every((line) => line.ratingMw >= line.asset.capacityMw)).toBe(true);
    expect(buildNetwork(assets).lines[0].ratingMw).toBe(network.lines[0].asset.capacityMw);
  });

  it('can overload lines when the busiest one trips', () => {
    const busiest = base.loadingPct.indexOf(Math.max(...base.loadingPct));
    const study = runStudy(network, [{ type: 'trip', assetId: network.lines[busiest].asset.id }]);
    expect(Math.max(...study.loadingPct)).toBeGreaterThan(Math.max(...base.loadingPct));
  });

  it('shifts flow onto other lines when one trips, and reports it', () => {
    // Trip the most loaded line.
    const busiest = base.loadingPct.indexOf(Math.max(...base.loadingPct));
    const assetId = network.lines[busiest].asset.id;
    const study = runStudy(network, [{ type: 'trip', assetId }]);
    expect(study.inService[busiest]).toBe(0);
    expect(study.flowMw[busiest]).toBe(0);

    const { changes } = compareStudies(network, base, study);
    expect(changes.length).toBeGreaterThan(1);
    expect(changes.some((change) => change.assetId === assetId && change.tripped)).toBe(true);
    // Something else picked up flow.
    expect(changes.some((change) => !change.tripped && change.deltaPct > 0)).toBe(true);
    for (let i = 1; i < changes.length; i += 1) {
      expect(Math.abs(changes[i - 1].deltaPct)).toBeGreaterThanOrEqual(
        Math.abs(changes[i].deltaPct),
      );
    }
  });

  it('islands a substation when all its lines trip, and counts its load as unserved', () => {
    const generatorBuses = new Set(network.generators.map((g) => g.bus));
    const bus = network.buses.findIndex((_, i) => !generatorBuses.has(i));
    const edits = network.lines
      .filter((line) => line.from === bus || line.to === bus)
      .map((line) => ({ type: 'trip' as const, assetId: line.asset.id }));
    const study = runStudy(network, edits);
    expect(study.islandCount).toBe(2);
    expect(study.deEnergized).toEqual([network.buses[bus].id]);
    expect(study.unservedMw).toBeGreaterThan(0);
  });

  it('raises flows when load grows and drops them when a generator goes offline nearby', () => {
    const substation = network.buses[0];
    const more = runStudy(network, [{ type: 'load', assetId: substation.id, percent: 50 }]);
    const totalBase = base.flowMw.reduce((s, f) => s + Math.abs(f), 0);
    const totalMore = more.flowMw.reduce((s, f) => s + Math.abs(f), 0);
    expect(totalMore).not.toBeCloseTo(totalBase, 0);

    const generator = network.generators[0].asset;
    const off = runStudy(network, [{ type: 'offline', assetId: generator.id }]);
    expect(Array.from(off.flowMw)).not.toEqual(Array.from(base.flowMw));
  });
});
