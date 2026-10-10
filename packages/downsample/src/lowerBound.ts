import type { DownsampleResult, Points } from './types.ts';

/** Index of the first time ≥ t in an ascending array (binary search), within [low, high). */
export const lowerBound = (time: ArrayLike<number>, t: number, low = 0, high = time.length) => {
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (time[mid] < t) low = mid + 1;
    else high = mid;
  }
  return low;
};

/** Indices of the points inside [from, to], plus one either side so lines reach the edges. */
export const visibleRange = (time: ArrayLike<number>, from: number, to: number) => {
  const start = Math.max(0, lowerBound(time, from) - 1);
  const end = Math.min(time.length, lowerBound(time, to) + 1);
  return { start, end: Math.max(start, end) };
};

/** Points [start, end) copied unchanged. */
export const copyRange = (
  { time, value }: Points,
  start: number,
  end: number,
): DownsampleResult => ({
  time: Float64Array.from({ length: end - start }, (_, i) => time[start + i]),
  value: Float64Array.from({ length: end - start }, (_, i) => value[start + i]),
  inputCount: end - start,
});
