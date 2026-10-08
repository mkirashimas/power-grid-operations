import { createRandom } from './random.ts';
import { DEFAULT_SEED } from './synthetic.ts';
import { periodToMs } from './telemetry.ts';
import type { HourlyPoint } from './types.ts';

/** A long, evenly spaced series as typed arrays: point i is (time[i], value[i]). */
export interface HighResSeries {
  /** Epoch milliseconds, ascending. */
  time: Float64Array;
  value: Float32Array;
  stepSeconds: number;
}

export interface HighResOptions {
  stepSeconds?: number;
  seed?: number;
}

/**
 * Synthetic system load at `stepSeconds` resolution (default 1 s) over the span of the EIA
 * demand series: the hourly demand interpolated linearly, plus slowly wandering noise and
 * short spikes. 30 days at 1 s is about 2.6M points: the kind of series that needs
 * downsampling before it can be drawn.
 */
export const generateHighResLoad = (
  demand: HourlyPoint[],
  { stepSeconds = 1, seed = DEFAULT_SEED }: HighResOptions = {},
): HighResSeries => {
  const known = demand
    .filter((point): point is { period: string; value: number } => point.value !== null)
    .map((point) => ({ t: periodToMs(point.period), value: point.value }));
  if (known.length < 2) {
    throw new Error('The demand series needs at least two values');
  }

  const stepMs = stepSeconds * 1000;
  const start = known[0].t;
  const length = Math.floor((known[known.length - 1].t - start) / stepMs) + 1;
  const time = new Float64Array(length);
  const value = new Float32Array(length);
  const random = createRandom(seed);

  let segment = 0;
  let drift = 0; // slow, mean-reverting noise (MW)
  let spike = 0; // decaying disturbance (MW)
  for (let i = 0; i < length; i += 1) {
    const t = start + i * stepMs;
    while (segment < known.length - 2 && known[segment + 1].t <= t) segment += 1;
    const a = known[segment];
    const b = known[segment + 1];
    const base = a.value + ((b.value - a.value) * (t - a.t)) / (b.t - a.t);

    drift = 0.999 * drift + 6 * random.normal();
    // About two disturbances per hour, each decaying over roughly a minute.
    if (random.next() < 2 / 3600) spike += (random.next() < 0.5 ? -1 : 1) * random.range(400, 1500);
    spike *= 0.985;

    time[i] = t;
    value[i] = base + drift + spike + 25 * random.normal();
  }
  return { time, value, stepSeconds };
};
