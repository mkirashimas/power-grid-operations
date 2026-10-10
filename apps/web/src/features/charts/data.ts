import { findSeries, periodToMs, type EiaSnapshot, type HourlyPoint } from '@pgo/grid-model';

export interface Series {
  time: Float64Array;
  value: Float64Array;
}

export interface FuelSeries extends Series {
  key: FuelGroup;
}

/** Fuel groups shown in the stacked chart; the rest of EIA's codes go into 'other'. */
export const FUEL_GROUPS = ['gas', 'wind', 'solar', 'nuclear', 'coal', 'other'] as const;

export type FuelGroup = (typeof FUEL_GROUPS)[number];

const FUEL_OF: Record<string, FuelGroup> = {
  'fuel:NG': 'gas',
  'fuel:WND': 'wind',
  'fuel:SUN': 'solar',
  'fuel:NUC': 'nuclear',
  'fuel:COL': 'coal',
};

export interface ChartData {
  /** Whole range: from the first demand hour to the last forecast hour. */
  full: [number, number];
  demand: Series;
  forecast: Series;
  /** Between demand and forecast, at hours that have both. */
  error: { time: Float64Array; lower: Float64Array; upper: Float64Array };
  fuels: FuelSeries[];
  interchange: Series;
}

const toSeries = (points: HourlyPoint[] = []): Series => {
  const known = points.filter((point) => point.value !== null);
  return {
    time: Float64Array.from(known, (point) => periodToMs(point.period)),
    value: Float64Array.from(known, (point) => point.value!),
  };
};

/** Turns the EIA snapshot into typed series for the charts. */
export const prepareChartData = (snapshot: EiaSnapshot): ChartData => {
  const demand = toSeries(findSeries(snapshot, 'demand')?.points);
  const forecast = toSeries(findSeries(snapshot, 'forecast')?.points);
  const interchange = toSeries(findSeries(snapshot, 'interchange')?.points);

  const forecastAt = new Map(Array.from(forecast.time, (t, i) => [t, forecast.value[i]]));
  const errorTimes = Array.from(demand.time).filter((t) => forecastAt.has(t));
  const demandAt = new Map(Array.from(demand.time, (t, i) => [t, demand.value[i]]));
  const error = {
    time: Float64Array.from(errorTimes),
    lower: Float64Array.from(errorTimes, (t) => Math.min(demandAt.get(t)!, forecastAt.get(t)!)),
    upper: Float64Array.from(errorTimes, (t) => Math.max(demandAt.get(t)!, forecastAt.get(t)!)),
  };

  // Fuels share one time axis (stacked areas need it); a missing hour counts as 0.
  const fuelSeries = snapshot.series.filter((series) => series.id.startsWith('fuel:'));
  const hours = [
    ...new Set(fuelSeries.flatMap((series) => series.points.map((p) => periodToMs(p.period)))),
  ].sort((a, b) => a - b);
  const index = new Map(hours.map((t, i) => [t, i]));
  const fuels = FUEL_GROUPS.map((key): FuelSeries => ({
    key,
    time: Float64Array.from(hours),
    value: new Float64Array(hours.length),
  }));
  fuelSeries.forEach((series) => {
    const target = fuels[FUEL_GROUPS.indexOf(FUEL_OF[series.id] ?? 'other')];
    series.points.forEach((point) => {
      if (point.value !== null) target.value[index.get(periodToMs(point.period))!] += point.value;
    });
  });

  const starts = [demand, forecast].filter((s) => s.time.length).map((s) => s.time[0]);
  const ends = [demand, forecast]
    .filter((s) => s.time.length)
    .map((s) => s.time[s.time.length - 1]);
  return {
    full: [Math.min(...starts), Math.max(...ends)],
    demand,
    forecast,
    error,
    fuels,
    interchange,
  };
};
