import type { EiaSeries, EiaSnapshot } from '@pgo/grid-model';
import { describe, expect, it } from 'vitest';
import { selectKpis } from './kpis';

const series = (id: string, points: [string, number | null][]): EiaSeries => ({
  id,
  name: id,
  unit: 'MWh',
  points: points.map(([period, value]) => ({ period, value })),
});

const snapshot = (...list: EiaSeries[]): EiaSnapshot => ({
  source: 'U.S. Energy Information Administration',
  respondent: 'ERCO',
  fetchedAt: '2026-10-08T17:00:00.000Z',
  start: '2026-10-08T00',
  end: '2026-10-09T00',
  series: list,
});

describe('selectKpis', () => {
  it('uses the latest hour that has both demand and forecast', () => {
    const kpis = selectKpis(
      snapshot(
        series('demand', [
          ['2026-10-08T14', 50000],
          ['2026-10-08T15', 52000],
          ['2026-10-08T16', null],
        ]),
        // The forecast runs ahead of actual demand.
        series('forecast', [
          ['2026-10-08T14', 49000],
          ['2026-10-08T15', 50000],
          ['2026-10-08T16', 51000],
          ['2026-10-09T05', 55000],
        ]),
        series('interchange', [
          ['2026-10-08T03', -500],
          ['2026-10-08T04', -792],
          ['2026-10-08T05', null],
        ]),
      ),
    );

    expect(kpis).toEqual({
      demand: { period: '2026-10-08T15', value: 52000 },
      forecast: { period: '2026-10-08T15', value: 50000 },
      forecastError: 0.04,
      interchange: { period: '2026-10-08T04', value: -792 },
    });
  });

  it('returns null without a matching demand and forecast hour', () => {
    expect(
      selectKpis(
        snapshot(
          series('demand', [['2026-10-08T15', 52000]]),
          series('forecast', [['2026-10-08T16', 1]]),
        ),
      ),
    ).toBeNull();
  });

  it('tolerates a missing interchange series', () => {
    const kpis = selectKpis(
      snapshot(
        series('demand', [['2026-10-08T15', 100]]),
        series('forecast', [['2026-10-08T15', 100]]),
      ),
    );
    expect(kpis?.interchange).toBeNull();
    expect(kpis?.forecastError).toBe(0);
  });
});
