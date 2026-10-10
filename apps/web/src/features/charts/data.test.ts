import type { EiaSeries, EiaSnapshot } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { prepareChartData } from './data';

const series = (id: string, points: [string, number | null][]): EiaSeries => ({
  id,
  name: id,
  unit: 'MWh',
  points: points.map(([period, value]) => ({ period, value })),
});

const snapshot: EiaSnapshot = {
  source: 'U.S. Energy Information Administration',
  respondent: 'ERCO',
  fetchedAt: '2026-10-08T17:00:00.000Z',
  start: '2026-10-08T00',
  end: '2026-10-09T00',
  series: [
    series('demand', [
      ['2026-10-08T00', 50_000],
      ['2026-10-08T01', 52_000],
      ['2026-10-08T02', null],
    ]),
    series('forecast', [
      ['2026-10-08T01', 51_000],
      ['2026-10-08T02', 53_000],
      ['2026-10-08T03', 54_000],
    ]),
    series('interchange', [['2026-10-08T00', -700]]),
    series('fuel:NG', [
      ['2026-10-08T00', 20_000],
      ['2026-10-08T01', 21_000],
    ]),
    series('fuel:WND', [['2026-10-08T01', 9_000]]),
    series('fuel:BAT', [['2026-10-08T00', 300]]),
    series('fuel:OTH', [['2026-10-08T00', 200]]),
  ],
};

describe('prepareChartData', () => {
  const data = prepareChartData(snapshot);
  const hour = (h: number) => Date.UTC(2026, 9, 8, h);

  it('drops empty hours and spans demand through the last forecast hour', () => {
    expect(Array.from(data.demand.value)).toEqual([50_000, 52_000]);
    expect(data.full).toEqual([hour(0), hour(3)]);
  });

  it('builds the forecast-error band where both series have values', () => {
    expect(Array.from(data.error.time)).toEqual([hour(1)]);
    expect(Array.from(data.error.lower)).toEqual([51_000]);
    expect(Array.from(data.error.upper)).toEqual([52_000]);
  });

  it('puts fuels on one time axis, grouping minor fuels as other', () => {
    const fuel = (key: string) => data.fuels.find((f) => f.key === key)!;
    expect(Array.from(fuel('gas').time)).toEqual([hour(0), hour(1)]);
    expect(Array.from(fuel('gas').value)).toEqual([20_000, 21_000]);
    expect(Array.from(fuel('wind').value)).toEqual([0, 9_000]);
    expect(Array.from(fuel('other').value)).toEqual([500, 0]);
    expect(data.fuels.map((f) => f.key)).toEqual([
      'gas',
      'wind',
      'solar',
      'nuclear',
      'coal',
      'other',
    ]);
  });
});
