/** ERCOT weather zones, the regions ERCOT uses for load forecasting. */
export const WEATHER_ZONES = [
  'coast',
  'east',
  'far-west',
  'north',
  'north-central',
  'south-central',
  'southern',
  'west',
] as const;

export type WeatherZone = (typeof WEATHER_ZONES)[number];

export const ASSET_KINDS = ['substation', 'line', 'generator', 'load'] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const FUELS = ['gas', 'wind', 'solar', 'nuclear', 'coal', 'battery'] as const;

export type Fuel = (typeof FUELS)[number];

/** A synthetic grid asset. Lines sit at the midpoint of the substations they connect. */
export interface Asset {
  id: string;
  /** Position in the telemetry columns (`TelemetryColumns.assetIndex`). */
  index: number;
  kind: AssetKind;
  name: string;
  zone: WeatherZone;
  lat: number;
  lon: number;
  voltageKv: number;
  /** Rating: line or transformer limit, generator capacity, or load peak. */
  capacityMw: number;
  /** Generators only. */
  fuel?: Fuel;
  /** Generators and loads: the substation they connect to. Lines: the sending end. */
  substationId?: string;
  /** Lines only: the receiving end. */
  toSubstationId?: string;
}

/** One hourly value. `period` is the UTC hour as EIA writes it, e.g. "2026-10-09T05". */
export interface HourlyPoint {
  period: string;
  value: number | null;
}

export interface EiaSeries {
  /** 'demand' | 'forecast' | 'generation' | 'interchange' | 'fuel:<EIA fuel code>' */
  id: string;
  /** EIA's own name for the series, e.g. "Day-ahead demand forecast". */
  name: string;
  /** EIA reports MWh per hour, i.e. the hour's average MW. */
  unit: 'MWh';
  /** Ascending by period. */
  points: HourlyPoint[];
}

export interface EiaSnapshot {
  source: 'U.S. Energy Information Administration';
  respondent: 'ERCO';
  /** ISO timestamp of the download. */
  fetchedAt: string;
  /** First and last requested UTC hours. */
  start: string;
  end: string;
  series: EiaSeries[];
}

/**
 * Synthetic telemetry as parallel typed arrays: row i is
 * (assetIndex[i], timestamp[i], mw[i], loadingPct[i], voltagePu[i]).
 * Rows are ordered by asset, then time, so one asset's series is a contiguous slice.
 */
export interface TelemetryColumns {
  length: number;
  /** Number of time steps per asset. */
  steps: number;
  assetIndex: Uint16Array;
  /** Epoch milliseconds. */
  timestamp: Float64Array;
  mw: Float32Array;
  loadingPct: Float32Array;
  voltagePu: Float32Array;
}
