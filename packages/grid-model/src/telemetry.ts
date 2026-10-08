import { createRandom, deriveSeed, type Random } from './random.ts';
import { DEFAULT_SEED } from './synthetic.ts';
import type { Asset, HourlyPoint, TelemetryColumns } from './types.ts';

const HOUR_MS = 3_600_000;

/** Converts an EIA period ("2026-10-09T05", UTC) to epoch milliseconds. */
export const periodToMs = (period: string): number => {
  const [date, hour = '00'] = period.split('T');
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day, Number(hour));
};

export interface TelemetryWindow {
  /** Epoch ms, inclusive. */
  start: number;
  /** Epoch ms, exclusive. */
  end: number;
  intervalMinutes: number;
}

/** The last `days` days covered by the demand series, at `intervalMinutes` resolution. */
export const defaultTelemetryWindow = (
  demand: HourlyPoint[],
  days = 6,
  intervalMinutes = 15,
): TelemetryWindow => {
  const last = demand.findLast((point) => point.value !== null);
  if (!last) {
    throw new Error('The demand series has no values');
  }
  const end = periodToMs(last.period) + HOUR_MS;
  return { start: end - days * 24 * HOUR_MS, end, intervalMinutes };
};

/** Demand normalised to [0, 1] of its peak, linearly interpolated between hours. */
const createLoadShape = (demand: HourlyPoint[]) => {
  const known = demand
    .filter((point): point is { period: string; value: number } => point.value !== null)
    .map((point) => ({ t: periodToMs(point.period), value: point.value }));
  if (known.length === 0) {
    throw new Error('The demand series has no values');
  }
  const peak = Math.max(...known.map((point) => point.value));
  let cursor = 0;
  // Called with increasing t, so the cursor only moves forward.
  return (t: number) => {
    while (cursor < known.length - 2 && known[cursor + 1].t <= t) {
      cursor += 1;
    }
    const a = known[cursor];
    const b = known[Math.min(cursor + 1, known.length - 1)];
    if (t <= a.t || a.t === b.t) {
      return a.value / peak;
    }
    if (t >= b.t) {
      return b.value / peak;
    }
    return (a.value + ((b.value - a.value) * (t - a.t)) / (b.t - a.t)) / peak;
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Central Time hour of day, ignoring daylight saving (synthetic data). */
const localHour = (t: number) => (((t / HOUR_MS - 6) % 24) + 24) % 24;

interface StepContext {
  shape: number;
  hour: number;
}

/** Returns a per-step MW function for one asset; state (e.g. wind) lives in the closure. */
const createProfile = (asset: Asset, random: Random): ((step: StepContext) => number) => {
  const capacity = asset.capacityMw;
  switch (asset.kind) {
    case 'load':
      return ({ shape }) => capacity * shape * (1 + 0.03 * random.normal());
    case 'line': {
      // Fixed flow direction and a per-line stress level, so some lines run hot at peak.
      const direction = random.next() < 0.5 ? -1 : 1;
      const stress = random.range(0.45, 1.35);
      return ({ shape }) =>
        direction *
        capacity *
        clamp((0.25 + 0.55 * shape) * stress + 0.03 * random.normal(), 0, 1.3);
    }
    case 'generator':
      switch (asset.fuel) {
        case 'solar': {
          let cloud = random.range(0.7, 1);
          return ({ hour }) => {
            cloud = clamp(cloud + 0.05 * random.normal(), 0.4, 1);
            return capacity * Math.max(0, Math.sin((Math.PI * (hour - 6.5)) / 13)) * cloud;
          };
        }
        case 'wind': {
          let output = random.range(0.2, 0.6);
          return ({ hour }) => {
            const target = hour < 7 || hour > 20 ? 0.55 : 0.35; // windier at night
            output = clamp(output + 0.1 * (target - output) + 0.04 * random.normal(), 0.02, 0.95);
            return capacity * output;
          };
        }
        case 'nuclear':
          return () => capacity * (0.98 + 0.005 * random.normal());
        case 'coal':
          return ({ shape }) => capacity * clamp(0.55 + 0.3 * shape + 0.02 * random.normal(), 0, 1);
        case 'battery':
          // Charge (negative) around midday, discharge into the evening peak.
          return ({ hour }) => {
            if (hour >= 10 && hour < 15) return -capacity * 0.6;
            if (hour >= 18 && hour < 22) return capacity * 0.8;
            return capacity * 0.02 * random.normal();
          };
        default: // gas follows load, steeper at the peak
          return ({ shape }) =>
            capacity * clamp(0.25 + 0.75 * shape * shape + 0.05 * random.normal(), 0, 1);
      }
    default:
      return () => 0; // substations are aggregated from their loads and generators
  }
};

const voltage = (loadingPct: number, random: Random) =>
  clamp(1.04 - 0.06 * (loadingPct / 100) + 0.004 * random.normal(), 0.9, 1.1);

/**
 * Generates synthetic telemetry for every asset over the window. The load shape follows the
 * real EIA demand series; everything else is generated. Deterministic for a given seed.
 */
export const generateTelemetry = (
  assets: Asset[],
  demand: HourlyPoint[],
  window: TelemetryWindow = defaultTelemetryWindow(demand),
  seed = DEFAULT_SEED,
): TelemetryColumns => {
  const intervalMs = window.intervalMinutes * 60_000;
  const steps = Math.floor((window.end - window.start) / intervalMs);
  const length = assets.length * steps;
  const columns: TelemetryColumns = {
    length,
    steps,
    assetIndex: new Uint16Array(length),
    timestamp: new Float64Array(length),
    mw: new Float32Array(length),
    loadingPct: new Float32Array(length),
    voltagePu: new Float32Array(length),
  };

  const shapeAt = createLoadShape(demand);
  const contexts: StepContext[] = Array.from({ length: steps }, (_, step) => {
    const t = window.start + step * intervalMs;
    return { shape: shapeAt(t), hour: localHour(t) };
  });

  const writeRow = (asset: Asset, step: number, mw: number, loadingPct: number, random: Random) => {
    const row = asset.index * steps + step;
    columns.assetIndex[row] = asset.index;
    columns.timestamp[row] = window.start + step * intervalMs;
    columns.mw[row] = mw;
    columns.loadingPct[row] = loadingPct;
    columns.voltagePu[row] = voltage(loadingPct, random);
  };

  // Loads, generators and lines first; substations then aggregate their rows.
  assets.forEach((asset) => {
    if (asset.kind === 'substation') return;
    const random = createRandom(deriveSeed(seed, asset.index));
    const profile = createProfile(asset, random);
    contexts.forEach((context, step) => {
      const mw = profile(context);
      writeRow(asset, step, mw, (Math.abs(mw) / asset.capacityMw) * 100, random);
    });
  });

  const attached = new Map<string, Asset[]>();
  assets.forEach((asset) => {
    if ((asset.kind === 'load' || asset.kind === 'generator') && asset.substationId) {
      attached.set(asset.substationId, [...(attached.get(asset.substationId) ?? []), asset]);
    }
  });
  assets.forEach((substation) => {
    if (substation.kind !== 'substation') return;
    const random = createRandom(deriveSeed(seed, substation.index));
    const equipment = attached.get(substation.id) ?? [];
    for (let step = 0; step < steps; step += 1) {
      let load = 0;
      let generation = 0;
      equipment.forEach((asset) => {
        const mw = columns.mw[asset.index * steps + step];
        if (asset.kind === 'load') load += mw;
        else generation += mw;
      });
      // Net withdrawal: positive when the substation imports, negative when it exports.
      const loadingPct =
        (Math.max(load, Math.abs(generation)) / (substation.capacityMw || 1)) * 100;
      writeRow(substation, step, load - generation, loadingPct, random);
    }
  });

  return columns;
};
