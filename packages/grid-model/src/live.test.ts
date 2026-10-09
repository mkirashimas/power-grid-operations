import { describe, expect, it } from 'vitest';
import { generateAssets } from './assets.ts';
import { createLiveSimulator, type LiveAlarm } from './live.ts';
import { parseClientMessage } from './live-protocol.ts';
import type { HourlyPoint } from './types.ts';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 8, 1);
// 30 days of hourly demand with a daily shape.
const demand: HourlyPoint[] = Array.from({ length: 30 * 24 }, (_, i) => ({
  period: new Date(START + i * HOUR).toISOString().slice(0, 13),
  value: 50_000 + 10_000 * Math.sin(((i % 24) - 9) * (Math.PI / 12)),
}));
const assets = generateAssets();
const NOW = Date.UTC(2026, 9, 9, 12);

const run = (steps: number, options: { seed?: number; eventRate?: number } = {}) => {
  const simulator = createLiveSimulator({ assets, demand, ...options });
  const results = Array.from({ length: steps }, (_, i) => simulator.step(NOW + i * 1000));
  return { simulator, results };
};

describe('createLiveSimulator', () => {
  it('is deterministic for a seed', () => {
    const a = run(50, { seed: 7 }).results;
    const b = run(50, { seed: 7 }).results;
    const c = run(50, { seed: 8 }).results;
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it('follows the weekly demand shape and splits it by zone', () => {
    const { results } = run(1);
    const { tick } = results[0];
    // 12:00 UTC is hour 12 of the daily shape: 50,000 + 10,000 * sin(π/4).
    expect(tick.load).toBeGreaterThan(55_000);
    expect(tick.load).toBeLessThan(59_000);
    expect(tick.zones).toHaveLength(8);
    expect(tick.zones.reduce((sum, mw) => sum + mw, 0)).toBeCloseTo(tick.load, -1);
  });

  it('reports a sample of assets per step, with plausible values', () => {
    const { results } = run(20);
    results.forEach(({ tick }) => {
      expect(tick.assets.length % 3).toBe(0);
      const count = tick.assets.length / 3;
      expect(count).toBeGreaterThan(assets.length * 0.02);
      expect(count).toBeLessThan(assets.length * 0.15);
      for (let i = 0; i < tick.assets.length; i += 3) {
        expect(Number.isInteger(tick.assets[i])).toBe(true);
        expect(tick.assets[i + 1]).toBeGreaterThanOrEqual(0);
        expect(tick.assets[i + 2]).toBeGreaterThan(0.85);
        expect(tick.assets[i + 2]).toBeLessThan(1.15);
      }
    });
  });

  it('raises about one alarm per disturbance and clears them again', () => {
    const { results, simulator } = run(1800, { eventRate: 1 / 30 });
    const events = results.flatMap((r) => r.alarms);
    const raised = new Set(events.map((a) => a.id));
    // About 60 disturbances in 30 minutes; most cross a threshold.
    expect(raised.size).toBeGreaterThan(20);
    expect(raised.size).toBeLessThan(150);
    expect(events.some((a) => a.clearedAt !== null)).toBe(true);
    expect(simulator.recentAlarms(5)).toHaveLength(5);
    expect(simulator.recentAlarms()[0].raisedAt).toBeGreaterThanOrEqual(
      simulator.recentAlarms().at(-1)!.raisedAt,
    );
  });

  it('never raises the same condition twice while active (hysteresis)', () => {
    const { results } = run(1800, { eventRate: 1 / 20 });
    const open = new Map<string, string>();
    results
      .flatMap((r) => r.alarms)
      .forEach((alarm: LiveAlarm) => {
        const key = `${alarm.assetIndex}:${alarm.condition}`;
        const current = open.get(key);
        if (current) expect(alarm.id).toBe(current);
        if (alarm.clearedAt === null) open.set(key, alarm.id);
        else open.delete(key);
      });
  });

  it('escalates overloads from warning to alarm on the same record', () => {
    const { results } = run(3600, { eventRate: 1 / 10 });
    const byId = new Map<string, LiveAlarm[]>();
    results
      .flatMap((r) => r.alarms)
      .forEach((alarm) => byId.set(alarm.id, [...(byId.get(alarm.id) ?? []), alarm]));
    const escalated = [...byId.values()].find(
      (history) => history[0].severity === 'warning' && history.some((a) => a.severity === 'alarm'),
    );
    expect(escalated).toBeDefined();
    expect(escalated!.every((a) => a.condition === 'overload')).toBe(true);
  });

  it('reports the current values of one asset', () => {
    const { simulator, results } = run(5);
    const last = results.at(-1)!.tick.assets;
    const index = last[0];
    expect(simulator.assetValues(index)).toEqual({ loadingPct: last[1], voltagePu: last[2] });
    expect(simulator.assetValues(-1)).toBeUndefined();
    expect(simulator.assetValues(assets.length)).toBeUndefined();
  });

  it('acknowledges an alarm once', () => {
    const { simulator } = run(600, { eventRate: 1 / 10 });
    const [alarm] = simulator.recentAlarms(1);
    const acknowledged = simulator.acknowledge(alarm.id, NOW + 999);
    expect(acknowledged).toMatchObject({ id: alarm.id, acknowledgedAt: NOW + 999 });
    expect(simulator.recentAlarms(1)[0].acknowledgedAt).toBe(NOW + 999);
    expect(simulator.acknowledge(alarm.id, NOW + 1000)).toBeUndefined();
    expect(simulator.acknowledge('A999999', NOW)).toBeUndefined();
  });
});

describe('parseClientMessage', () => {
  it('accepts acks and rejects everything else', () => {
    expect(parseClientMessage('{"type":"ack","id":"A42"}')).toEqual({ type: 'ack', id: 'A42' });
    expect(parseClientMessage('{"type":"ack","id":"../etc"}')).toBeNull();
    expect(parseClientMessage('{"type":"ack"}')).toBeNull();
    expect(parseClientMessage('{"type":"drop-table"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('null')).toBeNull();
  });

  it('accepts watch messages with a valid asset index or null', () => {
    expect(parseClientMessage('{"type":"watch","index":42}')).toEqual({ type: 'watch', index: 42 });
    expect(parseClientMessage('{"type":"watch","index":null}')).toEqual({
      type: 'watch',
      index: null,
    });
    expect(parseClientMessage('{"type":"watch","index":-1}')).toBeNull();
    expect(parseClientMessage('{"type":"watch","index":1.5}')).toBeNull();
    expect(parseClientMessage('{"type":"watch","index":"7"}')).toBeNull();
    expect(parseClientMessage('{"type":"watch"}')).toBeNull();
  });
});
