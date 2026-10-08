import type { WeatherZone } from './types.ts';

export interface ZoneInfo {
  /** Short code used in asset ids and names. */
  code: string;
  /** Approximate bounding box over Texas. Synthetic assets are placed inside it. */
  lat: [min: number, max: number];
  lon: [min: number, max: number];
  /** Approximate share of ERCOT load, used to scale synthetic loads. Shares sum to 1. */
  loadShare: number;
}

// Approximations for a synthetic model, not ERCOT's official zone boundaries.
export const ZONES: Record<WeatherZone, ZoneInfo> = {
  coast: { code: 'CST', lat: [28.6, 30.4], lon: [-96.6, -94.1], loadShare: 0.28 },
  east: { code: 'EST', lat: [30.6, 33.4], lon: [-95.4, -93.7], loadShare: 0.04 },
  'far-west': { code: 'FWT', lat: [29.6, 32.4], lon: [-104.6, -101.6], loadShare: 0.07 },
  north: { code: 'NTH', lat: [33.1, 34.4], lon: [-99.9, -96.6], loadShare: 0.02 },
  'north-central': { code: 'NCT', lat: [31.6, 33.8], lon: [-98.4, -95.6], loadShare: 0.3 },
  'south-central': { code: 'SCT', lat: [29.1, 31.4], lon: [-98.9, -96.7], loadShare: 0.15 },
  southern: { code: 'STH', lat: [26.0, 28.9], lon: [-99.9, -97.2], loadShare: 0.1 },
  west: { code: 'WST', lat: [30.6, 33.9], lon: [-101.4, -98.6], loadShare: 0.04 },
};

/** Approximate ERCOT system peak, used to size synthetic loads. */
export const SYSTEM_PEAK_MW = 85_000;
