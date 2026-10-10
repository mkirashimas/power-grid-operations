import { solveDcFlow } from './dcFlow';
import { buildNetwork, BASE_MVA, type GridNetwork } from './network';
import type { Asset } from '@pgo/grid-model';

/** One change to the base case. Load changes target a substation's load, in percent. */
export type StudyEdit =
  | { type: 'trip'; assetId: string }
  | { type: 'load'; assetId: string; percent: number }
  | { type: 'offline'; assetId: string };

export interface StudyResult {
  /** Per network line (same order as `network.lines`). */
  flowMw: Float64Array;
  loadingPct: Float64Array;
  inService: Uint8Array;
  islandCount: number;
  /** Substations left without generation. */
  deEnergized: string[];
  /** Load in de-energised islands. */
  unservedMw: number;
}

/** Overloaded at or above this loading. */
export const OVERLOAD_PCT = 100;

/** Applies `edits` to the base case and solves the DC power flow. */
export const runStudy = (network: GridNetwork, edits: readonly StudyEdit[]): StudyResult => {
  const tripped = new Set<string>();
  const offline = new Set<string>();
  const loadScale = new Map<string, number>();
  edits.forEach((edit) => {
    if (edit.type === 'trip') tripped.add(edit.assetId);
    else if (edit.type === 'offline') offline.add(edit.assetId);
    else loadScale.set(edit.assetId, 1 + edit.percent / 100);
  });

  const busCount = network.buses.length;
  const injectionMw = new Float64Array(busCount);
  const slackWeight = new Float64Array(busCount);
  const loadMw = new Float64Array(busCount);
  network.loads.forEach(({ bus, mw, asset }) => {
    const scaled = mw * (loadScale.get(asset.substationId ?? '') ?? 1);
    injectionMw[bus] -= scaled;
    loadMw[bus] += scaled;
  });
  network.generators.forEach(({ bus, mw, asset }) => {
    if (offline.has(asset.id)) return;
    injectionMw[bus] += mw;
    slackWeight[bus] += asset.capacityMw;
  });

  const branches = network.lines.map(({ from, to, x, asset }) => ({
    from,
    to,
    x,
    inService: !tripped.has(asset.id),
  }));
  const result = solveDcFlow({
    busCount,
    branches,
    injections: Float64Array.from(injectionMw, (mw) => mw / BASE_MVA),
    slackWeight,
  });

  const flowMw = Float64Array.from(result.flows, (pu) => pu * BASE_MVA);
  const deEnergized: string[] = [];
  let unservedMw = 0;
  result.deEnergized.forEach((flag, bus) => {
    if (!flag) return;
    deEnergized.push(network.buses[bus].id);
    unservedMw += loadMw[bus];
  });
  return {
    flowMw,
    loadingPct: Float64Array.from(
      flowMw,
      (mw, i) => (Math.abs(mw) / network.lines[i].ratingMw) * 100,
    ),
    inService: Uint8Array.from(branches, (branch) => (branch.inService ? 1 : 0)),
    islandCount: result.islandCount,
    deEnergized,
    unservedMw,
  };
};

export interface LineChange {
  /** Position in `network.lines`. */
  line: number;
  assetId: string;
  name: string;
  basePct: number;
  studyPct: number;
  deltaPct: number;
  tripped: boolean;
}

export interface StudyComparison {
  /** Lines whose loading changed, largest change first (at most `limit`). */
  changes: LineChange[];
  /** Lines at or above OVERLOAD_PCT in the study but not in the base case. */
  newOverloads: string[];
}

/** What a study changes compared with the base case. */
export const compareStudies = (
  network: GridNetwork,
  base: StudyResult,
  study: StudyResult,
  limit = 12,
): StudyComparison => {
  const changes: LineChange[] = [];
  const newOverloads: string[] = [];
  network.lines.forEach(({ asset }, line) => {
    const basePct = base.loadingPct[line];
    const studyPct = study.loadingPct[line];
    const tripped = !study.inService[line];
    if (studyPct >= OVERLOAD_PCT && basePct < OVERLOAD_PCT) newOverloads.push(asset.id);
    const deltaPct = studyPct - basePct;
    if (Math.abs(deltaPct) >= 0.5 || tripped) {
      changes.push({
        line,
        assetId: asset.id,
        name: asset.name,
        basePct,
        studyPct,
        deltaPct,
        tripped,
      });
    }
  });
  changes.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  return { changes: changes.slice(0, limit), newOverloads };
};

/** Highest loading of any line in the base case (an N-0 secure operating point). */
export const BASE_CASE_MAX_LOADING = 0.8;

/**
 * The study network with an N-0 secure base case. The synthetic lines' nameplate ratings do not
 * come from a planned grid, so a consistent power flow overloads many of them before any edit.
 * Each line is rated at the larger of its nameplate rating and its base-case flow divided by
 * BASE_CASE_MAX_LOADING: the base case then peaks at 80 %, and edits show where the network is
 * weak.
 */
export const prepareNetwork = (assets: readonly Asset[]): GridNetwork => {
  const network = buildNetwork(assets);
  const base = runStudy(network, []);
  network.lines.forEach((line, i) => {
    line.ratingMw = Math.max(
      line.asset.capacityMw,
      Math.abs(base.flowMw[i]) / BASE_CASE_MAX_LOADING,
    );
  });
  return network;
};
