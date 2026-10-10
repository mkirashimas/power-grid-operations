import { lowerBound, type Domain } from './domain.ts';
import { downsampleMinMax, type DownsampleResult } from './downsample.ts';
import type { ChartBand, ChartSeries } from './types.ts';

export interface LineView {
  series: ChartSeries;
  time: ArrayLike<number>;
  value: ArrayLike<number>;
  min: number;
  max: number;
}

export interface StackView {
  time: ArrayLike<number>;
  layers: { series: ChartSeries; lower: Float64Array; upper: Float64Array }[];
}

export interface PaneView {
  /** Downsampled lines to draw (empty for stacked panes). */
  lines: LineView[];
  /** Every series with its visible min/max, for the screen-reader summary and readout. */
  summary: LineView[];
  stack?: StackView;
  band?: {
    band: ChartBand;
    time: ArrayLike<number>;
    lower: ArrayLike<number>;
    upper: ArrayLike<number>;
  };
  yMin: number;
  yMax: number;
  inputPoints: number;
  drawnPoints: number;
  /** Time spent preparing the data (downsampling, stacking). */
  ms: number;
}

const extent = (values: ArrayLike<number>) => {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (Number.isFinite(value)) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return { min, max };
};

/** Indices of the points inside the range, plus one either side so lines reach the edges. */
const visibleRange = (time: ArrayLike<number>, domain: Domain) => ({
  start: Math.max(0, lowerBound(time, domain[0]) - 1),
  end: Math.min(time.length, lowerBound(time, domain[1]) + 1),
});

const slice = (values: ArrayLike<number>, start: number, end: number) =>
  Float64Array.from({ length: Math.max(0, end - start) }, (_, i) => values[start + i]);

/**
 * Prepares what a pane draws for the visible range: lines are min/max-downsampled to the plot
 * width, stacked areas are summed (they share one time axis), and the band is clipped.
 * With `prepared` (lines downsampled elsewhere, by series id), lines are taken from it as they
 * are, and series not in it yet are left out.
 */
export const buildPaneView = (
  series: ChartSeries[],
  band: ChartBand | undefined,
  stacked: boolean,
  domain: Domain,
  plotWidth: number,
  prepared?: Readonly<Record<string, DownsampleResult>>,
): PaneView => {
  const started = performance.now();
  let inputPoints = 0;
  let drawnPoints = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  const include = (min: number, max: number) => {
    yMin = Math.min(yMin, min);
    yMax = Math.max(yMax, max);
  };

  const lines: LineView[] = [];
  let stack: StackView | undefined;

  if (stacked && series.length > 0) {
    const { start, end } = visibleRange(series[0].time, domain);
    const time = slice(series[0].time, start, end);
    let running = new Float64Array(time.length);
    const layers = series.map((s) => {
      const lower = running;
      const upper = Float64Array.from(lower, (base, i) => base + (s.value[start + i] || 0));
      running = upper;
      return { series: s, lower, upper };
    });
    const totals = extent(running);
    include(Math.min(0, totals.min), totals.max);
    inputPoints += time.length * series.length;
    drawnPoints += time.length * series.length;
    stack = { time, layers };
    series.forEach((s) => {
      const values = slice(s.value, start, end);
      const { min, max } = extent(values);
      lines.push({ series: s, time, value: values, min, max });
    });
  } else {
    series.forEach((s) => {
      const result = prepared
        ? prepared[s.id]
        : downsampleMinMax(s, domain[0], domain[1], plotWidth);
      if (!result) return;
      const { min, max } = extent(result.value);
      include(min, max);
      inputPoints += result.inputCount;
      drawnPoints += result.time.length;
      lines.push({ series: s, time: result.time, value: result.value, min, max });
    });
  }

  let bandView: PaneView['band'];
  if (band) {
    const { start, end } = visibleRange(band.time, domain);
    const lower = slice(band.lower, start, end);
    const upper = slice(band.upper, start, end);
    include(extent(lower).min, extent(upper).max);
    bandView = { band, time: slice(band.time, start, end), lower, upper };
  }

  return {
    lines: stacked ? [] : lines,
    summary: lines,
    stack,
    band: bandView,
    yMin: Number.isFinite(yMin) ? yMin : 0,
    yMax: Number.isFinite(yMax) ? yMax : 1,
    inputPoints,
    drawnPoints,
    ms: performance.now() - started,
  };
};
