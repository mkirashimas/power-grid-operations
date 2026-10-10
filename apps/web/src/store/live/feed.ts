import type { LiveAlarm, LoadPoint, ServerMessage } from '@pgo/grid-model';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/** Last 10 minutes at one point per second. */
export const HISTORY_LIMIT = 600;
export const ALARM_LIMIT = 500;

/**
 * Everything the realtime service has sent, as one RTK Query cache entry shared by every view
 * (alarms, map). Plain arrays and objects, so it stays serializable.
 */
export interface LiveFeedState {
  status: ConnectionStatus;
  tickMs: number;
  /** System load, oldest first. */
  history: LoadPoint[];
  /** Load per zone at the latest tick, in `WEATHER_ZONES` order. */
  zones: number[];
  /** Newest first. */
  alarms: LiveAlarm[];
  /** Latest loading (%) per asset index; empty until `hello`. */
  assetLoading: number[];
  /** Latest voltage (pu) per asset index; empty until `hello`. */
  assetVoltage: number[];
  /** Asset indexes updated by the latest message, for incremental redraws (e.g. a map). */
  changedAssets: number[];
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
  assetLoading: [],
  assetVoltage: [],
  changedAssets: [],
  clockOffsetMs: 0,
  latencyMs: null,
  messageCount: 0,
  watched: null,
});

/** Writes flat [index, loadingPct, voltagePu, …] triples; returns the indexes written. */
const writeAssets = (state: LiveFeedState, flat: readonly number[]) => {
  const changed: number[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) {
    const index = flat[i];
    state.assetLoading[index] = flat[i + 1];
    state.assetVoltage[index] = flat[i + 2];
    changed.push(index);
  }
  return changed;
};

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
      // Older servers send no asset snapshot.
      state.changedAssets = message.assets ? writeAssets(state, message.assets) : [];
      return;
    case 'tick': {
      const { time, load, zones, assets } = message.tick;
      state.history.push({ time, load });
      if (state.history.length > HISTORY_LIMIT) {
        state.history.splice(0, state.history.length - HISTORY_LIMIT);
      }
      state.zones = zones;
      state.latencyMs = Math.max(0, receivedAt + state.clockOffsetMs - time);
      state.changedAssets = writeAssets(state, assets);
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
      state.changedAssets = writeAssets(state, [index, loadingPct, voltagePu]);
      return;
    }
    default:
  }
};
