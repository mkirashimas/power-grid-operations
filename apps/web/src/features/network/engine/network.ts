import { distanceKm, type Asset, type Fuel } from '@pgo/grid-model';

/** System base for per-unit values. */
export const BASE_MVA = 100;

/** Line reactance per km at each voltage (typical overhead lines). */
const OHM_PER_KM: Record<number, number> = { 138: 0.4, 345: 0.3 };

/** Share of each load's peak in the study's operating point (a busy afternoon). */
export const STUDY_LOAD_FACTOR = 0.6;

/** Output as a share of capacity for must-run and variable plants, before dispatch. */
const AVAILABILITY: Partial<Record<Fuel, number>> = {
  nuclear: 0.95,
  wind: 0.35,
  solar: 0.5,
  battery: 0,
};

export interface NetworkLine {
  asset: Asset;
  from: number;
  to: number;
  /** Reactance in per unit on BASE_MVA. */
  x: number;
  ratingMw: number;
}

export interface NetworkLoad {
  asset: Asset;
  bus: number;
  mw: number;
}

export interface NetworkGenerator {
  asset: Asset;
  bus: number;
  mw: number;
}

/** The grid as buses (substations) and branches (lines), with a base operating point. */
export interface GridNetwork {
  buses: Asset[];
  busOf: Map<string, number>;
  lines: NetworkLine[];
  loads: NetworkLoad[];
  generators: NetworkGenerator[];
}

/**
 * Builds the study network from the synthetic assets. Loads run at STUDY_LOAD_FACTOR of their
 * peak; generation follows a simple merit order (nuclear, wind and solar at their availability,
 * then coal and gas share what is left) so the base case is balanced.
 */
export const buildNetwork = (assets: readonly Asset[]): GridNetwork => {
  const buses = assets.filter((asset) => asset.kind === 'substation');
  const busOf = new Map(buses.map((bus, i) => [bus.id, i]));
  const byId = new Map(assets.map((asset) => [asset.id, asset]));

  const lines: NetworkLine[] = [];
  const loads: NetworkLoad[] = [];
  const generators: NetworkGenerator[] = [];

  assets.forEach((asset) => {
    if (asset.kind === 'line') {
      const from = busOf.get(asset.substationId ?? '');
      const to = busOf.get(asset.toSubstationId ?? '');
      if (from === undefined || to === undefined) return;
      const lengthKm = Math.max(
        1,
        distanceKm(byId.get(asset.substationId!)!, byId.get(asset.toSubstationId!)!),
      );
      const ohm = (OHM_PER_KM[asset.voltageKv] ?? 0.4) * lengthKm;
      const zBase = (asset.voltageKv * asset.voltageKv) / BASE_MVA;
      lines.push({ asset, from, to, x: ohm / zBase, ratingMw: asset.capacityMw });
    } else if (asset.kind === 'load') {
      const bus = busOf.get(asset.substationId ?? '');
      if (bus !== undefined) loads.push({ asset, bus, mw: asset.capacityMw * STUDY_LOAD_FACTOR });
    } else if (asset.kind === 'generator') {
      const bus = busOf.get(asset.substationId ?? '');
      if (bus !== undefined) generators.push({ asset, bus, mw: 0 });
    }
  });

  // Merit order: fixed availability first, then coal and gas pro rata up to their capacity.
  const demand = loads.reduce((sum, load) => sum + load.mw, 0);
  let fixed = 0;
  generators.forEach((generator) => {
    const availability = AVAILABILITY[generator.asset.fuel ?? 'gas'];
    if (availability !== undefined) {
      generator.mw = generator.asset.capacityMw * availability;
      fixed += generator.mw;
    }
  });
  const flexible = generators.filter((g) => AVAILABILITY[g.asset.fuel ?? 'gas'] === undefined);
  const flexibleCapacity = flexible.reduce((sum, g) => sum + g.asset.capacityMw, 0);
  const share = Math.min(1, Math.max(0, (demand - fixed) / (flexibleCapacity || 1)));
  flexible.forEach((generator) => (generator.mw = generator.asset.capacityMw * share));
  // Too much fixed output (a windy night): scale it down to the demand.
  if (fixed > demand) {
    generators.forEach((generator) => {
      if (AVAILABILITY[generator.asset.fuel ?? 'gas'] !== undefined) {
        generator.mw *= demand / fixed;
      }
    });
  }

  return { buses, busOf, lines, loads, generators };
};
