import { findSeries, type EiaSnapshot, type HourlyPoint } from '@pgo/grid-model';

export interface Reading {
  /** EIA period, UTC hour, e.g. "2026-10-08T16". */
  period: string;
  value: number;
}

export interface ErcotKpis {
  demand: Reading;
  /** Day-ahead forecast for the same hour as `demand`. */
  forecast: Reading;
  /** (demand − forecast) / forecast. */
  forecastError: number;
  /** Latest net interchange; EIA reports it later than demand, so its hour can differ. */
  interchange: Reading | null;
}

const toValueMap = (points: HourlyPoint[] = []) =>
  new Map(
    points
      .filter((point): point is Reading => point.value !== null)
      .map((point) => [point.period, point.value]),
  );

const latest = (points: HourlyPoint[] = []): Reading | null => {
  const point = points.findLast((p): p is Reading => p.value !== null);
  return point ?? null;
};

/** Latest hour that has both actual demand and its day-ahead forecast. */
export const selectKpis = (snapshot: EiaSnapshot): ErcotKpis | null => {
  const demand = findSeries(snapshot, 'demand')?.points ?? [];
  const forecasts = toValueMap(findSeries(snapshot, 'forecast')?.points);

  const hour = demand.findLast(
    (point): point is Reading => point.value !== null && forecasts.has(point.period),
  );
  if (!hour) {
    return null;
  }
  const forecast = forecasts.get(hour.period)!;
  return {
    demand: hour,
    forecast: { period: hour.period, value: forecast },
    forecastError: (hour.value - forecast) / forecast,
    interchange: latest(findSeries(snapshot, 'interchange')?.points),
  };
};
