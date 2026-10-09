import { describe, expect, it } from 'vitest';
import {
  clampDomain,
  lastSpan,
  lowerBound,
  MIN_SPAN_MS,
  nearestIndex,
  panBy,
  zoomAround,
  type Domain,
} from './domain.ts';
import { timeTicks, timeZoneOffset, valueScale } from './ticks.ts';

const HOUR = 3_600_000;
const FULL: Domain = [0, 30 * 24 * HOUR];

describe('domain math', () => {
  it('clamps ranges into the full range and to a minimum span', () => {
    expect(clampDomain([-5 * HOUR, 5 * HOUR], FULL)).toEqual([0, 10 * HOUR]);
    expect(clampDomain([FULL[1] - HOUR, FULL[1] + HOUR], FULL)).toEqual([
      FULL[1] - 2 * HOUR,
      FULL[1],
    ]);
    expect(clampDomain([10 * HOUR, 10 * HOUR + 1], FULL)).toEqual([
      10 * HOUR,
      10 * HOUR + MIN_SPAN_MS,
    ]);
    expect(clampDomain([-1e12, 1e12], FULL)).toEqual(FULL);
  });

  it('zooms around an anchor, which keeps its relative position', () => {
    const domain: Domain = [0, 100 * HOUR];
    const zoomed = zoomAround(domain, 25 * HOUR, 0.5, FULL);
    expect(zoomed).toEqual([12.5 * HOUR, 62.5 * HOUR]);
    const relative = (d: Domain) => (25 * HOUR - d[0]) / (d[1] - d[0]);
    expect(relative(zoomed)).toBeCloseTo(relative(domain));
  });

  it('pans without changing the width, stopping at the edges', () => {
    expect(panBy([0, 10 * HOUR], 5 * HOUR, FULL)).toEqual([5 * HOUR, 15 * HOUR]);
    expect(panBy([0, 10 * HOUR], -5 * HOUR, FULL)).toEqual([0, 10 * HOUR]);
    expect(lastSpan(FULL, 24 * HOUR)).toEqual([FULL[1] - 24 * HOUR, FULL[1]]);
  });

  it('finds positions by binary search', () => {
    const time = [0, 10, 20, 30];
    expect(lowerBound(time, 15)).toBe(2);
    expect(lowerBound(time, 40)).toBe(4);
    expect(nearestIndex(time, 14)).toBe(1);
    expect(nearestIndex(time, 16)).toBe(2);
    expect(nearestIndex(time, -5)).toBe(0);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});
describe('ticks', () => {
  it('computes time-zone offsets, including daylight saving', () => {
    expect(timeZoneOffset(Date.UTC(2026, 6, 1), 'America/Chicago')).toBe(-5 * HOUR);
    expect(timeZoneOffset(Date.UTC(2026, 11, 1), 'America/Chicago')).toBe(-6 * HOUR);
  });

  it('places day ticks at local midnight in the chart time zone', () => {
    const from = Date.UTC(2026, 9, 1, 12);
    const ticks = timeTicks([from, from + 7 * 24 * HOUR], 7, 'America/Chicago');
    expect(ticks.length).toBeGreaterThan(3);
    ticks.forEach((tick) =>
      expect(new Date(tick + timeZoneOffset(tick, 'America/Chicago')).getUTCHours()).toBe(0),
    );
  });

  it('builds nice value axes, optionally including zero', () => {
    expect(valueScale(43_210, 78_900, false).domain()).toEqual([40_000, 80_000]);
    expect(valueScale(-800, 300, true).domain()[0]).toBeLessThanOrEqual(-800);
    expect(valueScale(5, 5, false).domain()[0]).toBeLessThan(5);
  });
});
