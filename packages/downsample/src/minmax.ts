import { copyRange, lowerBound, visibleRange } from './lowerBound.ts';
import type { DownsampleResult, Points } from './types.ts';

/**
 * Min/max ("M4") downsampling for drawing: splits [from, to] into `buckets` columns (one per
 * pixel) and keeps the first, minimum, maximum and last point of each, in time order. A line
 * through these points looks identical to one through every point, so no peak is lost, and
 * the output never exceeds 4 points per bucket. One point either side of the range is kept so
 * the line runs to the edges. Mirrored in Rust (`rust/src/lib.rs`).
 */
export const downsampleMinMax = (
  points: Points,
  from: number,
  to: number,
  buckets: number,
): DownsampleResult => {
  const { time, value } = points;
  const { start, end } = visibleRange(time, from, to);
  const inputCount = end - start;
  const columns = Math.max(1, Math.floor(buckets));

  // Few enough points already: copy them through.
  if (inputCount <= columns * 4) return copyRange(points, start, end);

  const outTime = new Float64Array(columns * 4 + 2);
  const outValue = new Float64Array(columns * 4 + 2);
  let out = 0;
  const push = (i: number) => {
    if (out > 0 && outTime[out - 1] === time[i] && outValue[out - 1] === value[i]) return;
    outTime[out] = time[i];
    outValue[out] = value[i];
    out += 1;
  };

  const width = (to - from) / columns;
  let i = start;
  while (i < end) {
    const column = Math.min(columns - 1, Math.max(0, Math.floor((time[i] - from) / width)));
    const columnEnd = from + (column + 1) * width;
    // Points before `from` and after `to` fall into the first and last columns. The end of the
    // column is found by binary search, so only the values are scanned. Every column takes at
    // least one point, even if rounding puts time[i] on its end.
    const groupEnd =
      column === columns - 1 ? end : Math.max(i + 1, lowerBound(time, columnEnd, i, end));
    const first = i;
    const last = groupEnd - 1;
    let min = i;
    let max = i;
    let minValue = value[i];
    let maxValue = value[i];
    for (let j = i; j < groupEnd; j += 1) {
      const v = value[j];
      if (v < minValue) {
        minValue = v;
        min = j;
      }
      if (v > maxValue) {
        maxValue = v;
        max = j;
      }
    }
    i = groupEnd;
    push(first);
    if (min < max) {
      push(min);
      push(max);
    } else {
      push(max);
      push(min);
    }
    push(last);
  }
  return { time: outTime.subarray(0, out), value: outValue.subarray(0, out), inputCount };
};
