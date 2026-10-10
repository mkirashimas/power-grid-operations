export const THEME_MODES = ['light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** Chart series colour keys, in palette order. */
export const CHART_SERIES = [
  'series1',
  'series2',
  'series3',
  'series4',
  'series5',
  'series6',
] as const;

export type ChartSeriesColor = (typeof CHART_SERIES)[number];

export const STATUSES = ['normal', 'warning', 'alarm', 'offline'] as const;

/** Operational state of an asset or reading. */
export type Status = (typeof STATUSES)[number];
