import type { LiveAlarm } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { countAlarms, filterAlarms } from './live';

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
