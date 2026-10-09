import type { LiveAlarm, LoadPoint, ServerMessage, WeatherZone } from '@pgo/grid-model';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/** Last 10 minutes at one point per second. */
export const HISTORY_LIMIT = 600;
export const ALARM_LIMIT = 500;

export interface LiveFeedState {
  status: ConnectionStatus;
  tickMs: number;
  /** System load, oldest first. */
  history: LoadPoint[];
  /** Load per zone at the latest tick, in `WEATHER_ZONES` order. */
  zones: number[];
  /** Newest first. */
  alarms: LiveAlarm[];
  /** Server clock minus browser clock, measured on `hello`. */
  clockOffsetMs: number;
  /** Time from the server's tick to its arrival here. */
  latencyMs: number | null;
  /** Messages received since the page opened, for an updates-per-second rate. */
  messageCount: number;
  /** Latest values of the asset this client watches (the linked selection). */
  watched: WatchedAsset | null;
}

export interface WatchedAsset {
  index: number;
  time: number;
  loadingPct: number;
  voltagePu: number;
}

export const initialLiveFeed = (): LiveFeedState => ({
  status: 'connecting',
  tickMs: 1000,
  history: [],
  zones: [],
  alarms: [],
  clockOffsetMs: 0,
  latencyMs: null,
  messageCount: 0,
  watched: null,
});

/**
 * Folds one server message into the feed. Written for an Immer draft (RTK Query's
 * `updateCachedData`): it mutates `state`.
 */
export const applyMessage = (state: LiveFeedState, message: ServerMessage, receivedAt: number) => {
  state.messageCount += 1;
  switch (message.type) {
    case 'hello':
      state.status = 'live';
      state.tickMs = message.tickMs;
      state.history = message.history.slice(-HISTORY_LIMIT);
      state.alarms = message.alarms.slice(0, ALARM_LIMIT);
      state.clockOffsetMs = message.serverTime - receivedAt;
      return;
    case 'tick': {
      const { time, load, zones } = message.tick;
      state.history.push({ time, load });
      if (state.history.length > HISTORY_LIMIT) {
        state.history.splice(0, state.history.length - HISTORY_LIMIT);
      }
      state.zones = zones;
      state.latencyMs = Math.max(0, receivedAt + state.clockOffsetMs - time);
      return;
    }
    case 'alarm': {
      const index = state.alarms.findIndex((alarm) => alarm.id === message.alarm.id);
      if (index >= 0) state.alarms[index] = message.alarm;
      else {
        state.alarms.unshift(message.alarm);
        if (state.alarms.length > ALARM_LIMIT) state.alarms.length = ALARM_LIMIT;
      }
      return;
    }
    case 'asset': {
      const { index, time, loadingPct, voltagePu } = message;
      state.watched = { index, time, loadingPct, voltagePu };
      return;
    }
    default:
  }
};

export interface AlarmCounts {
  activeAlarms: number;
  activeWarnings: number;
  unacknowledged: number;
}

export const countAlarms = (alarms: readonly LiveAlarm[]): AlarmCounts =>
  alarms.reduce<AlarmCounts>(
    (counts, alarm) => {
      if (alarm.clearedAt === null) {
        if (alarm.severity === 'alarm') counts.activeAlarms += 1;
        else counts.activeWarnings += 1;
      }
      if (alarm.acknowledgedAt === null) counts.unacknowledged += 1;
      return counts;
    },
    { activeAlarms: 0, activeWarnings: 0, unacknowledged: 0 },
  );

export type SeverityFilter = 'all' | 'alarm' | 'warning';
export type ZoneFilter = 'all' | WeatherZone;

export const filterAlarms = (
  alarms: readonly LiveAlarm[],
  severity: SeverityFilter,
  zone: ZoneFilter,
) =>
  alarms.filter(
    (alarm) =>
      (severity === 'all' || alarm.severity === severity) &&
      (zone === 'all' || alarm.zone === zone),
  );
