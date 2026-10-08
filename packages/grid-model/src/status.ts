/** Operational status of a telemetry reading, from least to most severe. */
export const TELEMETRY_STATUSES = ['normal', 'warning', 'alarm'] as const;

export type TelemetryStatus = (typeof TELEMETRY_STATUSES)[number];

export const LOADING_WARNING_PCT = 90;
export const LOADING_ALARM_PCT = 100;
export const VOLTAGE_MIN_PU = 0.95;
export const VOLTAGE_MAX_PU = 1.05;

/** Severity as a number (0 normal, 1 warning, 2 alarm), for sorting and "worst of". */
export const statusSeverity = (status: TelemetryStatus) => TELEMETRY_STATUSES.indexOf(status);

/**
 * Status of one reading:
 * - alarm: loading at or above 100 %, or voltage outside 0.95–1.05 pu
 * - warning: loading at or above 90 %
 * - normal: otherwise
 */
export const statusOf = (loadingPct: number, voltagePu: number): TelemetryStatus => {
  if (loadingPct >= LOADING_ALARM_PCT || voltagePu < VOLTAGE_MIN_PU || voltagePu > VOLTAGE_MAX_PU) {
    return 'alarm';
  }
  return loadingPct >= LOADING_WARNING_PCT ? 'warning' : 'normal';
};
