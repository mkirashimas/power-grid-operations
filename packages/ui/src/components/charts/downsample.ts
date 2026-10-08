import { lowerBound } from './domain.ts';

export interface Points {
  time: ArrayLike<number>;
  value: ArrayLike<number>;
}

export interface DownsampleResult {
  time: Float64Array;
  value: Float64Array;
  /** Points of the input inside the range. */
  inputCount: number;
}

/**
 * Min/max ("M4") downsampling for drawing: splits [from, to] into `buckets` columns (one per
 * pixel) and keeps the first, minimum, maximum and last point of each, in time order. A line
 * through these points looks identical to one through every point, so no peak is lost, and
 * the output never exceeds 4 points per bucket. One point either side of the range is kept so
 * the line runs to the edges.
 */
export const downsampleMinMax = (
  { time, value }: Points,
  from: number,
  to: number,
  buckets: number,
): DownsampleResult => {
  const start = Math.max(0, lowerBound(time, from) - 1);
  const end = Math.min(time.length, lowerBound(time, to) + 1);
  const inputCount = Math.max(0, end - start);
  const columns = Math.max(1, Math.floor(buckets));

  // Few enough points already: copy them through.
  if (inputCount <= columns * 4) {
    return {
      time: Float64Array.from({ length: inputCount }, (_, i) => time[start + i]),
      value: Float64Array.from({ length: inputCount }, (_, i) => value[start + i]),
      inputCount,
    };
  }

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
    const first = i;
    let min = i;
    let max = i;
    let last = i;
    // Points before `from` and after `to` fall into the first and last columns.
    while (i < end && (time[i] < columnEnd || column === columns - 1)) {
      if (value[i] < value[min]) min = i;
      if (value[i] > value[max]) max = i;
      last = i;
      i += 1;
    }
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
