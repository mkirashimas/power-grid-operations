import type { LiveAlarm, WeatherZone } from '@pgo/grid-model';

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
