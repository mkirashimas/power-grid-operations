import { scaleLinear, scaleUtc } from 'd3-scale';
import type { Domain } from './domain.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Offset of a time zone from UTC at an instant, in ms (e.g. -5 h for CDT). */
export const timeZoneOffset = (t: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(t);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return wall - Math.floor(t / 60_000) * 60_000;
};

/**
 * Round time ticks (midnights, whole hours…) in the chart's time zone rather than the
 * browser's: ticks are computed on shifted UTC times and shifted back.
 */
export const timeTicks = (domain: Domain, count: number, timeZone: string): number[] => {
  const offset = timeZoneOffset((domain[0] + domain[1]) / 2, timeZone);
  return scaleUtc()
    .domain([domain[0] + offset, domain[1] + offset])
    .ticks(count)
    .map((date) => date.getTime() - offset);
};

/** Label format for time ticks, by visible span. */
export const timeTickFormat = (domain: Domain, locale: string, timeZone: string) => {
  const span = domain[1] - domain[0];
  const options: Intl.DateTimeFormatOptions =
    span > 3 * DAY
      ? { month: 'short', day: 'numeric' }
      : span > DAY
        ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' };
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  return (t: number) => format.format(t);
};

/** A "nice" value axis covering [min, max] (with zero included when requested). */
export const valueScale = (min: number, max: number, includeZero: boolean) => {
  const low = includeZero ? Math.min(0, min) : min;
  const high = includeZero ? Math.max(0, max) : max;
  const pad = high === low ? Math.abs(high) * 0.1 || 1 : 0;
  return scaleLinear()
    .domain([low - pad, high + pad])
    .nice(5);
};

/** "Oct 1, 14:00 – Oct 8, 14:00" in the chart's time zone. */
export const formatRange = (domain: Domain, locale: string, timeZone: string) => {
  const format = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  return `${format.format(domain[0])} – ${format.format(domain[1])}`;
};

/** Full timestamp for readouts and tables, e.g. "Oct 8, 2026, 14:05:30 CDT". */
export const formatInstant = (t: number, locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone,
  }).format(t);
