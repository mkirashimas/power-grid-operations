import type { ChartSeriesColor } from '../../theme/types.ts';
import type { Domain } from './domain.ts';

export interface ChartSeries {
  id: string;
  label: string;
  color: ChartSeriesColor;
  /** Ascending epoch ms. */
  time: ArrayLike<number>;
  value: ArrayLike<number>;
  dashed?: boolean;
}

/** A shaded area between two curves on the same times, e.g. forecast error. */
export interface ChartBand {
  label: string;
  color: ChartSeriesColor;
  time: ArrayLike<number>;
  lower: ArrayLike<number>;
  upper: ArrayLike<number>;
}

/** Per-draw numbers, e.g. for a "2,592,000 → 1,840 points in 6 ms" readout. */
export interface RenderStats {
  inputPoints: number;
  drawnPoints: number;
  ms: number;
}

/** What a pane shows, for its screen-reader summary. */
export interface PaneSummaryInput {
  from: number;
  to: number;
  series: { label: string; min: number; max: number }[];
}

/** All text the charts show; the app passes it translated. */
export interface ChartLabels {
  toolbar: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  presets: { day: string; week: string; month: string };
  presetsLabel: string;
  showTable: string;
  hideTable: string;
  time: string;
  overview: string;
  /** Explains the keyboard controls; read after a chart's summary. */
  keyboardHint: string;
}

export interface ChartContextValue {
  full: Domain;
  domain: Domain;
  setDomain: (domain: Domain) => void;
  /** Shared crosshair time, or null. */
  crosshair: number | null;
  setCrosshair: (time: number | null) => void;
  locale: string;
  timeZone: string;
  labels: ChartLabels;
}
