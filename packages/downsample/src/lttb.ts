import { copyRange, visibleRange } from './lowerBound.ts';
import type { DownsampleResult, Points } from './types.ts';

/**
 * Largest-Triangle-Three-Buckets (Steinarsson, 2013): keeps the first and last point of
 * [from, to] and, from each of `threshold - 2` buckets, the point that forms the largest
 * triangle with the previously kept point and the average of the next bucket. It keeps the
 * shape of the line with one point per bucket, but may drop a spike one sample wide.
 * Mirrored in Rust (`rust/src/lib.rs`) operation for operation.
 */
export const downsampleLttb = (
  points: Points,
  from: number,
  to: number,
  threshold: number,
): DownsampleResult => {
  const { start, end } = visibleRange(points.time, from, to);
  const n = end - start;
  const target = Math.floor(threshold);
  if (target < 3 || n <= target) return copyRange(points, start, end);

  const x = (i: number) => points.time[start + i];
  const y = (i: number) => points.value[start + i];
  const outTime = new Float64Array(target);
  const outValue = new Float64Array(target);
  outTime[0] = x(0);
  outValue[0] = y(0);

  const every = (n - 2) / (target - 2);
  let a = 0;
  for (let bucket = 0; bucket < target - 2; bucket += 1) {
    // Average of the next bucket.
    const avgStart = Math.floor((bucket + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((bucket + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j += 1) {
      avgX += x(j);
      avgY += y(j);
    }
    avgX /= avgEnd - avgStart;
    avgY /= avgEnd - avgStart;

    // The point of this bucket with the largest triangle.
    const rangeStart = Math.floor(bucket * every) + 1;
    const rangeEnd = Math.floor((bucket + 1) * every) + 1;
    const ax = x(a);
    const ay = y(a);
    let maxArea = -1;
    let chosen = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j += 1) {
      const area = Math.abs((ax - avgX) * (y(j) - ay) - (ax - x(j)) * (avgY - ay));
      if (area > maxArea) {
        maxArea = area;
        chosen = j;
      }
    }
    outTime[bucket + 1] = x(chosen);
    outValue[bucket + 1] = y(chosen);
    a = chosen;
  }

  outTime[target - 1] = x(n - 1);
  outValue[target - 1] = y(n - 1);
  return { time: outTime, value: outValue, inputCount: n };
};
