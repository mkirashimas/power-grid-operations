/** A time range in epoch milliseconds: [from, to]. */
export type Domain = readonly [from: number, to: number];

/** Smallest range the charts zoom into. */
export const MIN_SPAN_MS = 60 * 60 * 1000;

/** Keeps a range inside `full`, at least `minSpan` wide, preserving its width when possible. */
export const clampDomain = (domain: Domain, full: Domain, minSpan = MIN_SPAN_MS): Domain => {
  const fullSpan = full[1] - full[0];
  const span = Math.min(fullSpan, Math.max(minSpan, domain[1] - domain[0]));
  const from = Math.min(Math.max(domain[0], full[0]), full[1] - span);
  return [from, from + span];
};

/**
 * Zooms by `factor` (< 1 zooms in, > 1 zooms out) keeping the time at `anchor` at the same
 * place on screen, e.g. under the mouse pointer.
 */
export const zoomAround = (
  domain: Domain,
  anchor: number,
  factor: number,
  full: Domain,
  minSpan = MIN_SPAN_MS,
): Domain => {
  const from = anchor - (anchor - domain[0]) * factor;
  const to = anchor + (domain[1] - anchor) * factor;
  return clampDomain([from, to], full, minSpan);
};

/** Shifts the range by `deltaMs`, stopping at the edges of `full`. */
export const panBy = (domain: Domain, deltaMs: number, full: Domain): Domain =>
  clampDomain([domain[0] + deltaMs, domain[1] + deltaMs], full, domain[1] - domain[0]);

/** The last `spanMs` of `full`, e.g. "last 24 h". */
export const lastSpan = (full: Domain, spanMs: number): Domain =>
  clampDomain([full[1] - spanMs, full[1]], full);

/** Index of the first time ≥ t in an ascending array (binary search). */
export const lowerBound = (time: ArrayLike<number>, t: number) => {
  let low = 0;
  let high = time.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (time[mid] < t) low = mid + 1;
    else high = mid;
  }
  return low;
};

/** Index of the point closest to t, or -1 for an empty array. */
export const nearestIndex = (time: ArrayLike<number>, t: number) => {
  if (time.length === 0) return -1;
  const i = lowerBound(time, t);
  if (i === 0) return 0;
  if (i === time.length) return time.length - 1;
  return t - time[i - 1] <= time[i] - t ? i - 1 : i;
};
