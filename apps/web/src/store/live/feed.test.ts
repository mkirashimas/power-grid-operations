import type { LiveAlarm, ServerMessage } from '@pgo/grid-model';
import { createNextState } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import {
  ALARM_LIMIT,
  applyMessage,
  HISTORY_LIMIT,
  initialLiveFeed,
  type LiveFeedState,
} from './feed';

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
  assets: [0, 50, 1, 1, 60, 1.01, 2, 95.5, 0.94],
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

describe('applyMessage for the watched asset', () => {
  it('keeps the latest values of the watched asset', () => {
    let state = apply(initialLiveFeed(), hello);
    expect(state.watched).toBeNull();
    state = apply(state, {
      type: 'asset',
      time: 11_000,
      index: 7,
      loadingPct: 64.2,
      voltagePu: 1.003,
    });
    expect(state.watched).toEqual({ index: 7, time: 11_000, loadingPct: 64.2, voltagePu: 1.003 });
  });
});

describe('applyMessage for asset values', () => {
  it('fills every asset from hello and updates the ones in each tick', () => {
    let state = apply(initialLiveFeed(), hello);
    expect(state.assetLoading).toEqual([50, 60, 95.5]);
    expect(state.assetVoltage).toEqual([1, 1.01, 0.94]);
    expect(state.changedAssets).toEqual([0, 1, 2]);

    state = apply(state, {
      type: 'tick',
      tick: { time: 10_000, load: 1, zones: [], assets: [1, 99, 1.02] },
    });
    expect(state.assetLoading).toEqual([50, 99, 95.5]);
    expect(state.assetVoltage[1]).toBe(1.02);
    expect(state.changedAssets).toEqual([1]);

    state = apply(state, { type: 'alarm', alarm: alarm(9) });
    expect(state.changedAssets).toEqual([1]);
  });

  it('accepts a hello without assets from an older server', () => {
    const { assets: _assets, ...older } = hello as Extract<ServerMessage, { type: 'hello' }>;
    const state = apply(initialLiveFeed(), older as ServerMessage);
    expect(state.status).toBe('live');
    expect(state.assetLoading).toEqual([]);
  });
});
