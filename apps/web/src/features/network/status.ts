import { statusOf, type TelemetryStatus } from '@pgo/grid-model';
import { OVERLOAD_PCT } from './engine/study';

/** Loading at or above this is a warning in the study (as in the telemetry thresholds). */
export const STUDY_WARNING_PCT = 90;

/** Status of a live reading (loading and voltage), or 'normal' before the first value. */
export const liveStatus = (loadingPct?: number, voltagePu?: number): TelemetryStatus =>
  loadingPct === undefined || voltagePu === undefined ? 'normal' : statusOf(loadingPct, voltagePu);

/** Status of a line's loading in a DC study (voltage is not part of the model). */
export const studyStatus = (loadingPct: number): TelemetryStatus =>
  loadingPct >= OVERLOAD_PCT ? 'alarm' : loadingPct >= STUDY_WARNING_PCT ? 'warning' : 'normal';
