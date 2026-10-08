/** A seeded random source: same seed, same sequence. */
export interface Random {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Uniform in [min, max). */
  range: (min: number, max: number) => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  /** Standard normal (Box–Muller). */
  normal: () => number;
  pick: <T>(items: readonly T[]) => T;
}

/** mulberry32: small, fast and good enough for synthetic data. */
export const createRandom = (seed: number): Random => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    normal: () => {
      const u = 1 - next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    pick: (items) => items[Math.floor(next() * items.length)],
  };
};

/** Derives an independent seed, e.g. one per asset, so results do not depend on order. */
export const deriveSeed = (seed: number, salt: number) =>
  Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
