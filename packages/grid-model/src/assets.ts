import { createRandom, type Random } from './random.ts';
import { DEFAULT_SEED } from './synthetic.ts';
import { WEATHER_ZONES, type Asset, type Fuel, type WeatherZone } from './types.ts';
import { SYSTEM_PEAK_MW, ZONES } from './zones.ts';

export interface AssetOptions {
  seed?: number;
  substations?: number;
  generators?: number;
  /** Lines from each substation to its nearest neighbours, before de-duplication. */
  neighbours?: number;
}

const DEFAULTS: Required<AssetOptions> = {
  seed: DEFAULT_SEED,
  substations: 400,
  generators: 300,
  neighbours: 3,
};

// Rough fuel mix per zone: wind and solar out west, gas and nuclear near the load centres.
const FUEL_MIX: Record<WeatherZone, Partial<Record<Fuel, number>>> = {
  coast: { gas: 0.75, battery: 0.15, solar: 0.1 },
  east: { gas: 0.6, coal: 0.3, solar: 0.1 },
  'far-west': { solar: 0.5, wind: 0.3, gas: 0.2 },
  north: { wind: 0.6, gas: 0.4 },
  'north-central': { gas: 0.6, solar: 0.15, wind: 0.1, coal: 0.1, battery: 0.05 },
  'south-central': { gas: 0.5, solar: 0.3, battery: 0.2 },
  southern: { wind: 0.5, gas: 0.3, solar: 0.2 },
  west: { wind: 0.6, solar: 0.25, gas: 0.15 },
};

const CAPACITY_MW: Record<Fuel, [number, number]> = {
  gas: [200, 800],
  wind: [100, 350],
  solar: [50, 300],
  nuclear: [1200, 1300],
  coal: [500, 900],
  battery: [50, 250],
};

const FUEL_NAMES: Record<Fuel, string> = {
  gas: 'Gas',
  wind: 'Wind',
  solar: 'Solar',
  nuclear: 'Nuclear',
  coal: 'Coal',
  battery: 'Battery',
};

// Two nuclear plants, as in ERCOT (one near Dallas–Fort Worth, one on the coast).
const NUCLEAR_ZONES: WeatherZone[] = ['north-central', 'coast'];

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/** Equirectangular distance in km; plenty accurate within Texas. */
export const distanceKm = (a: Pick<Asset, 'lat' | 'lon'>, b: Pick<Asset, 'lat' | 'lon'>) => {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dx = (a.lon - b.lon) * Math.cos(meanLat) * 111.32;
  const dy = (a.lat - b.lat) * 110.57;
  return Math.hypot(dx, dy);
};

/** Splits `total` across zones in proportion to `weight`, using largest remainders. */
const allocate = (total: number, weight: (zone: WeatherZone) => number) => {
  const weights = WEATHER_ZONES.map(weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (w / sum) * total);
  const counts = exact.map(Math.floor);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  const missing = total - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < missing; i += 1) {
    counts[byRemainder[i].index] += 1;
  }
  return new Map(WEATHER_ZONES.map((zone, index) => [zone, counts[index]]));
};

const pickFuel = (random: Random, zone: WeatherZone): Fuel => {
  const mix = Object.entries(FUEL_MIX[zone]) as [Fuel, number][];
  let roll = random.next();
  for (const [fuel, share] of mix) {
    roll -= share;
    if (roll < 0) {
      return fuel;
    }
  }
  return mix[mix.length - 1][0];
};

const createSubstations = (random: Random, total: number): Asset[] => {
  // Square-root weighting keeps sparse western zones populated.
  const counts = allocate(total, (zone) => Math.sqrt(ZONES[zone].loadShare));
  return WEATHER_ZONES.flatMap((zone) => {
    const { code, lat, lon } = ZONES[zone];
    return Array.from({ length: counts.get(zone) ?? 0 }, (_, i): Asset => {
      const voltageKv = random.next() < 0.25 ? 345 : 138;
      return {
        id: `sub-${code.toLowerCase()}-${pad(i + 1, 3)}`,
        index: -1,
        kind: 'substation',
        name: `${code}-${pad(i + 1, 3)} ${voltageKv} kV`,
        zone,
        lat: random.range(lat[0], lat[1]),
        lon: random.range(lon[0], lon[1]),
        voltageKv,
        capacityMw: 0, // sized from the attached equipment below
      };
    });
  });
};

const createLoads = (random: Random, substations: Asset[]): Asset[] => {
  const perZone = new Map<WeatherZone, number>();
  substations.forEach((s) => perZone.set(s.zone, (perZone.get(s.zone) ?? 0) + 1));
  return substations.map((substation, i) => {
    const average =
      (ZONES[substation.zone].loadShare * SYSTEM_PEAK_MW) / perZone.get(substation.zone)!;
    return {
      id: `ld-${ZONES[substation.zone].code.toLowerCase()}-${pad(i + 1, 3)}`,
      index: -1,
      kind: 'load',
      name: `${ZONES[substation.zone].code} Load ${pad(i + 1, 3)}`,
      zone: substation.zone,
      lat: substation.lat,
      lon: substation.lon,
      voltageKv: substation.voltageKv,
      capacityMw: Math.round(average * random.range(0.6, 1.4)),
      substationId: substation.id,
    };
  });
};

const createGenerators = (random: Random, substations: Asset[], total: number): Asset[] => {
  const byZone = new Map<WeatherZone, Asset[]>();
  substations.forEach((s) => byZone.set(s.zone, [...(byZone.get(s.zone) ?? []), s]));
  const counts = allocate(total - NUCLEAR_ZONES.length, (zone) => byZone.get(zone)?.length ?? 0);

  const plan: { zone: WeatherZone; fuel: Fuel }[] = [
    ...NUCLEAR_ZONES.map((zone) => ({ zone, fuel: 'nuclear' as const })),
    ...WEATHER_ZONES.flatMap((zone) =>
      Array.from({ length: counts.get(zone) ?? 0 }, () => ({ zone, fuel: pickFuel(random, zone) })),
    ),
  ];

  return plan.map(({ zone, fuel }, i) => {
    const substation = random.pick(byZone.get(zone)!);
    const [min, max] = CAPACITY_MW[fuel];
    return {
      id: `gen-${ZONES[zone].code.toLowerCase()}-${pad(i + 1, 3)}`,
      index: -1,
      kind: 'generator',
      name: `${ZONES[zone].code} ${FUEL_NAMES[fuel]} ${pad(i + 1, 3)}`,
      zone,
      lat: substation.lat,
      lon: substation.lon,
      voltageKv: substation.voltageKv,
      capacityMw: Math.round(random.range(min, max)),
      fuel,
      substationId: substation.id,
    };
  });
};

/** Union–find over substation positions, used to make the network connected. */
const createComponents = (size: number) => {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  return {
    find,
    union: (a: number, b: number) => {
      parent[find(a)] = find(b);
    },
  };
};

const createLines = (random: Random, substations: Asset[], neighbours: number): Asset[] => {
  const pairs = new Set<string>();
  const components = createComponents(substations.length);
  const addPair = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (a !== b && !pairs.has(key)) {
      pairs.add(key);
      components.union(a, b);
    }
  };

  // Each substation connects to its nearest neighbours.
  substations.forEach((substation, a) => {
    substations
      .map((other, b) => ({ b, distance: distanceKm(substation, other) }))
      .filter(({ b }) => b !== a)
      .sort((x, y) => x.distance - y.distance)
      .slice(0, neighbours)
      .forEach(({ b }) => addPair(a, b));
  });

  // Join any islands to the main network through their closest pair of substations.
  for (;;) {
    const root = components.find(0);
    const island = substations.findIndex((_, i) => components.find(i) !== root);
    if (island < 0) {
      break;
    }
    let best = { a: -1, b: -1, distance: Infinity };
    substations.forEach((s, a) => {
      if (components.find(a) !== root) {
        return;
      }
      substations.forEach((t, b) => {
        if (components.find(b) === components.find(island)) {
          const distance = distanceKm(s, t);
          if (distance < best.distance) {
            best = { a, b, distance };
          }
        }
      });
    });
    addPair(best.a, best.b);
  }

  return [...pairs].map((key, i) => {
    const [a, b] = key.split(':').map(Number);
    const from = substations[a];
    const to = substations[b];
    const voltageKv = from.voltageKv === 345 && to.voltageKv === 345 ? 345 : 138;
    const [min, max] = voltageKv === 345 ? [900, 1600] : [150, 400];
    return {
      id: `ln-${pad(i + 1, 4)}`,
      index: -1,
      kind: 'line',
      name: `L${pad(i + 1, 4)} ${from.name.split(' ')[0]}–${to.name.split(' ')[0]}`,
      zone: from.zone,
      lat: (from.lat + to.lat) / 2,
      lon: (from.lon + to.lon) / 2,
      voltageKv,
      capacityMw: Math.round(random.range(min, max)),
      substationId: from.id,
      toSubstationId: to.id,
    };
  });
};

/**
 * Generates the synthetic grid: substations, one load per substation, generators and the
 * lines between substations. Deterministic for a given seed. Returned in the order
 * substations, loads, generators, lines, with `index` set to the position in that list.
 */
export const generateAssets = (options: AssetOptions = {}): Asset[] => {
  const {
    seed,
    substations: substationCount,
    generators,
    neighbours,
  } = { ...DEFAULTS, ...options };
  const random = createRandom(seed);

  const substations = createSubstations(random, substationCount);
  const loads = createLoads(random, substations);
  const generatorAssets = createGenerators(random, substations, generators);
  const lines = createLines(random, substations, neighbours);

  // Transformer rating: the larger of attached load and generation, with headroom.
  const attached = new Map<string, { load: number; generation: number }>();
  [...loads, ...generatorAssets].forEach((asset) => {
    const totals = attached.get(asset.substationId!) ?? { load: 0, generation: 0 };
    totals[asset.kind === 'load' ? 'load' : 'generation'] += asset.capacityMw;
    attached.set(asset.substationId!, totals);
  });
  substations.forEach((substation) => {
    const totals = attached.get(substation.id) ?? { load: 0, generation: 0 };
    substation.capacityMw = Math.round(Math.max(totals.load, totals.generation) * 1.3);
  });

  return [...substations, ...loads, ...generatorAssets, ...lines].map((asset, index) => ({
    ...asset,
    index,
  }));
};
