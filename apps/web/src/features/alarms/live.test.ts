import type { LiveAlarm, ServerMessage } from '@pgo/grid-model';
import { createNextState } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import {
  ALARM_LIMIT,
  applyMessage,
  countAlarms,
  filterAlarms,
  HISTORY_LIMIT,
  initialLiveFeed,
  type LiveFeedState,
} from './live';

const alarm = (n: number, patch: Partial<LiveAlarm> = {}): LiveAlarm => ({
  id: `A${n}`,
  assetIndex: n,
  assetId: `asset-${n}`,
  assetName: `Asset ${n}`,
  kind: 'line',
  zone: n % 2 ? 'coast' : 'west',
  condition: 'overload',
  severity: n % 3 ? 'warning' : 'alarm',
  value: 95,
  raisedAt: 1000 + n,
  clearedAt: null,
  acknowledgedAt: null,
  ...patch,
});

// Same as RTK Query's updateCachedData: an Immer draft.
const apply = (state: LiveFeedState, message: ServerMessage, receivedAt = 10_000) =>
  createNextState(state, (draft) => applyMessage(draft, message, receivedAt));

const hello: ServerMessage = {
  type: 'hello',
  serverTime: 10_050,
  tickMs: 1000,
  history: [{ time: 9000, load: 50_000 }],
  alarms: [alarm(2), alarm(1)],
};

describe('applyMessage', () => {
  it('goes live on hello and measures the clock offset', () => {
    const state = apply(initialLiveFeed(), hello);
    expect(state.status).toBe('live');
    expect(state.history).toHaveLength(1);
    expect(state.alarms.map((a) => a.id)).toEqual(['A2', 'A1']);
    expect(state.clockOffsetMs).toBe(50);
  });

  it('appends ticks, caps the history and computes latency', () => {
    let state = apply(initialLiveFeed(), hello);
    for (let i = 0; i < HISTORY_LIMIT + 10; i += 1) {
      state = apply(
        state,
        { type: 'tick', tick: { time: 10_000 + i, load: 50_000 + i, zones: [1, 2], assets: [] } },
        10_000 + i,
      );
    }
    expect(state.history).toHaveLength(HISTORY_LIMIT);
    expect(state.history.at(-1)).toEqual({ time: 10_000 + HISTORY_LIMIT + 9, load: 50_609 });
    expect(state.zones).toEqual([1, 2]);
    expect(state.latencyMs).toBe(50);
    expect(state.messageCount).toBe(HISTORY_LIMIT + 11);
  });

  it('adds new alarms first, replaces updated ones and caps the list', () => {
    let state = apply(initialLiveFeed(), hello);
    state = apply(state, { type: 'alarm', alarm: alarm(3) });
    expect(state.alarms.map((a) => a.id)).toEqual(['A3', 'A2', 'A1']);

    state = apply(state, { type: 'alarm', alarm: alarm(2, { acknowledgedAt: 5 }) });
    expect(state.alarms.map((a) => a.id)).toEqual(['A3', 'A2', 'A1']);
    expect(state.alarms[1].acknowledgedAt).toBe(5);

    for (let n = 10; n < 10 + ALARM_LIMIT; n += 1) {
      state = apply(state, { type: 'alarm', alarm: alarm(n) });
    }
    expect(state.alarms).toHaveLength(ALARM_LIMIT);
    expect(state.alarms[0].id).toBe(`A${9 + ALARM_LIMIT}`);
  });
});

describe('countAlarms and filterAlarms', () => {
  const alarms = [alarm(3), alarm(1), alarm(2, { clearedAt: 9 }), alarm(4, { acknowledgedAt: 7 })];

  it('counts active alarms and warnings, and everything unacknowledged', () => {
    expect(countAlarms(alarms)).toEqual({
      activeAlarms: 1,
      activeWarnings: 2,
      unacknowledged: 3,
    });
  });

  it('filters by severity and zone', () => {
    expect(filterAlarms(alarms, 'all', 'all')).toHaveLength(4);
    expect(filterAlarms(alarms, 'alarm', 'all').map((a) => a.id)).toEqual(['A3']);
    expect(filterAlarms(alarms, 'warning', 'west').map((a) => a.id)).toEqual(['A2', 'A4']);
  });
});
