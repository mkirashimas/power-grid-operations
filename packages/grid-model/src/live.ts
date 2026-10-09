import { createRandom } from './random.ts';
import {
  LOADING_ALARM_PCT,
  LOADING_WARNING_PCT,
  VOLTAGE_MAX_PU,
  VOLTAGE_MIN_PU,
} from './status.ts';
import { DEFAULT_SEED } from './synthetic.ts';
import { periodToMs } from './telemetry.ts';
import {
  WEATHER_ZONES,
  type Asset,
  type AssetKind,
  type HourlyPoint,
  type WeatherZone,
} from './types.ts';
import { ZONES } from './zones.ts';

const WEEK_MS = 7 * 24 * 3_600_000;

export const ALARM_CONDITIONS = ['overload', 'undervoltage', 'overvoltage'] as const;
export type AlarmCondition = (typeof ALARM_CONDITIONS)[number];

export const ALARM_SEVERITIES = ['warning', 'alarm'] as const;
export type AlarmSeverity = (typeof ALARM_SEVERITIES)[number];

/** Alarms clear only this far inside their threshold, so they don't flicker. */
export const LOADING_HYSTERESIS_PCT = 3;
export const VOLTAGE_HYSTERESIS_PU = 0.01;

/** One alarm on one asset, from raise to clear. Records are replaced, never mutated. */
export interface LiveAlarm {
  id: string;
  assetIndex: number;
  assetId: string;
  assetName: string;
  kind: AssetKind;
  zone: WeatherZone;
  condition: AlarmCondition;
  /** Highest severity reached while active. */
  severity: AlarmSeverity;
  /** Value when raised or escalated: loading in % or voltage in pu. */
  value: number;
  raisedAt: number;
  clearedAt: number | null;
  acknowledgedAt: number | null;
}

/** One simulation step. */
export interface LiveTick {
  /** Epoch ms. */
  time: number;
  /** System load in MW. */
  load: number;
  /** Load per weather zone in MW, in `WEATHER_ZONES` order. */
  zones: number[];
  /** Changed assets as flat triples: [index, loadingPct, voltagePu, index, …]. */
  assets: number[];
}

export interface LiveStep {
  tick: LiveTick;
  /** Alarms raised, escalated or cleared in this step. */
  alarms: LiveAlarm[];
}

export interface LiveSimulatorOptions {
  assets: Asset[];
  /** Hourly EIA demand; its weekly shape drives the live system load. */
  demand: HourlyPoint[];
  seed?: number;
  /** Chance per step of a disturbance (overload, voltage sag or swell) on a random asset. */
  eventRate?: number;
  /** Share of assets reported per step, besides the ones that changed status. */
  sampleShare?: number;
  /** Alarms kept for `recentAlarms`. */
  keep?: number;
}

export interface LiveSimulator {
  step: (now: number) => LiveStep;
  /** Marks an alarm acknowledged; returns the new record, or undefined if unknown or done. */
  acknowledge: (id: string, now: number) => LiveAlarm | undefined;
  /** Newest first. */
  recentAlarms: (limit?: number) => LiveAlarm[];
}

interface Disturbance {
  loading: number;
  voltage: number;
  remaining: number;
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * A live, synthetic grid: system load follows the EIA demand of the same hour of the week,
 * each asset's loading and voltage wander around a baseline, and seeded disturbances raise
 * alarms with the telemetry table's thresholds (`status.ts`). Pure apart from its own state:
 * the same seed and the same `now` values give the same steps.
 */
export const createLiveSimulator = ({
  assets,
  demand,
  seed = DEFAULT_SEED,
  eventRate = 1 / 30,
  sampleShare = 0.05,
  keep = 500,
}: LiveSimulatorOptions): LiveSimulator => {
  const random = createRandom(seed);
  const known = demand.filter((p): p is { period: string; value: number } => p.value !== null);
  const times = known.map((p) => periodToMs(p.period));
  const values = known.map((p) => p.value);
  const meanLoad = values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);

  /** Demand at the same hour of the week within the last week of data, interpolated. */
  const weeklyLoad = (now: number) => {
    if (values.length === 0) return 0;
    const last = times[times.length - 1];
    const t = last - WEEK_MS + ((((now - last) % WEEK_MS) + WEEK_MS) % WEEK_MS);
    const i = times.findIndex((time) => time >= t);
    if (i <= 0) return values[Math.max(0, i)];
    const share = (t - times[i - 1]) / (times[i] - times[i - 1]);
    return values[i - 1] + share * (values[i] - values[i - 1]);
  };

  const n = assets.length;
  const baseline = Float64Array.from(assets, () => random.range(35, 70));
  const loadingWalk = new Float64Array(n);
  const voltageWalk = new Float64Array(n);
  const loading = new Float64Array(n);
  const voltage = new Float64Array(n).fill(1);
  const disturbances = new Map<number, Disturbance>();
  let loadNoise = 0;
  let sequence = 0;

  const active = new Map<string, LiveAlarm>();
  /** Open alarms per asset, for the fast path in `step`. */
  const openAlarms = new Uint8Array(n);
  let recent: LiveAlarm[] = [];
  const remember = (alarm: LiveAlarm) => {
    const index = recent.findIndex((a) => a.id === alarm.id);
    if (index >= 0) recent[index] = alarm;
    else recent = [alarm, ...recent].slice(0, keep);
  };

  const disturb = () => {
    const index = random.int(0, n - 1);
    const roll = random.next();
    const remaining = random.int(15, 90);
    disturbances.set(
      index,
      roll < 0.6
        ? { loading: random.range(25, 45), voltage: 0, remaining }
        : roll < 0.85
          ? { loading: 0, voltage: -random.range(0.06, 0.09), remaining }
          : { loading: 0, voltage: random.range(0.06, 0.08), remaining },
    );
  };

  /** Raises, escalates or clears one condition; returns the changed record, if any. */
  const evaluate = (
    index: number,
    condition: AlarmCondition,
    value: number,
    now: number,
  ): LiveAlarm | undefined => {
    const key = `${index}:${condition}`;
    const current = active.get(key);
    let severity: AlarmSeverity | null;
    let clears: boolean;
    let worse: (a: number, b: number) => number;
    if (condition === 'overload') {
      severity =
        value >= LOADING_ALARM_PCT ? 'alarm' : value >= LOADING_WARNING_PCT ? 'warning' : null;
      clears = value < LOADING_WARNING_PCT - LOADING_HYSTERESIS_PCT;
      worse = Math.max;
    } else if (condition === 'undervoltage') {
      severity = value < VOLTAGE_MIN_PU ? 'alarm' : null;
      clears = value > VOLTAGE_MIN_PU + VOLTAGE_HYSTERESIS_PU;
      worse = Math.min;
    } else {
      severity = value > VOLTAGE_MAX_PU ? 'alarm' : null;
      clears = value < VOLTAGE_MAX_PU - VOLTAGE_HYSTERESIS_PU;
      worse = Math.max;
    }

    if (!current) {
      if (!severity) return undefined;
      const asset = assets[index];
      sequence += 1;
      const alarm: LiveAlarm = {
        id: `A${sequence}`,
        assetIndex: index,
        assetId: asset.id,
        assetName: asset.name,
        kind: asset.kind,
        zone: asset.zone,
        condition,
        severity,
        value: round(value, condition === 'overload' ? 1 : 3),
        raisedAt: now,
        clearedAt: null,
        acknowledgedAt: null,
      };
      active.set(key, alarm);
      openAlarms[index] += 1;
      return alarm;
    }
    if (clears) {
      const alarm = { ...current, clearedAt: now };
      active.delete(key);
      openAlarms[index] -= 1;
      return alarm;
    }
    if (severity === 'alarm' && current.severity === 'warning') {
      const alarm: LiveAlarm = {
        ...current,
        severity,
        value: round(worse(current.value, value), condition === 'overload' ? 1 : 3),
      };
      active.set(key, alarm);
      return alarm;
    }
    return undefined;
  };

  const step = (now: number): LiveStep => {
    loadNoise = loadNoise * 0.95 + random.normal() * 0.001;
    const load = weeklyLoad(now) * (1 + loadNoise);
    const factor = meanLoad > 0 ? load / meanLoad : 1;
    if (random.next() < eventRate) disturb();

    const changed: LiveAlarm[] = [];
    const reported = new Set<number>();
    for (let i = 0; i < n; i += 1) {
      loadingWalk[i] = loadingWalk[i] * 0.98 + random.normal() * 0.4;
      voltageWalk[i] = voltageWalk[i] * 0.95 + random.normal() * 0.002;
      const disturbance = disturbances.get(i);
      let extraLoading = 0;
      let extraVoltage = 0;
      if (disturbance) {
        // Full effect, then a ramp down over the last 10 steps.
        const strength = Math.min(1, disturbance.remaining / 10);
        extraLoading = disturbance.loading * strength;
        extraVoltage = disturbance.voltage * strength;
        disturbance.remaining -= 1;
        if (disturbance.remaining <= 0) disturbances.delete(i);
        reported.add(i);
      }
      loading[i] = Math.max(0, baseline[i] * factor + loadingWalk[i] + extraLoading);
      voltage[i] = 1 + voltageWalk[i] + extraVoltage;

      // Fast path: a healthy asset with no open alarm cannot change any alarm.
      const healthy =
        loading[i] < LOADING_WARNING_PCT &&
        voltage[i] >= VOLTAGE_MIN_PU &&
        voltage[i] <= VOLTAGE_MAX_PU;
      if (!healthy || openAlarms[i] > 0) {
        for (const condition of ALARM_CONDITIONS) {
          const alarm = evaluate(
            i,
            condition,
            condition === 'overload' ? loading[i] : voltage[i],
            now,
          );
          if (alarm) {
            changed.push(alarm);
            remember(alarm);
            reported.add(i);
          }
        }
      }
      if (random.next() < sampleShare) reported.add(i);
    }

    const flat: number[] = [];
    [...reported]
      .sort((a, b) => a - b)
      .forEach((i) => flat.push(i, round(loading[i], 1), round(voltage[i], 3)));

    return {
      tick: {
        time: now,
        load: Math.round(load),
        zones: WEATHER_ZONES.map((zone) => Math.round(load * ZONES[zone].loadShare)),
        assets: flat,
      },
      alarms: changed,
    };
  };

  const acknowledge = (id: string, now: number) => {
    const alarm = recent.find((a) => a.id === id);
    if (!alarm || alarm.acknowledgedAt !== null) return undefined;
    const acknowledged = { ...alarm, acknowledgedAt: now };
    remember(acknowledged);
    const key = `${alarm.assetIndex}:${alarm.condition}`;
    if (active.get(key)?.id === id) active.set(key, acknowledged);
    return acknowledged;
  };

  return { step, acknowledge, recentAlarms: (limit = keep) => recent.slice(0, limit) };
};
