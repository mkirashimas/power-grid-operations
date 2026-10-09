// Named exports only: Next.js cannot follow `export *` into 'use client' modules when a server
// component imports this barrel.
export { ChartWorkbench, type ChartWorkbenchProps } from './components/charts/ChartWorkbench.tsx';
export { clampDomain, lastSpan, MIN_SPAN_MS, type Domain } from './components/charts/domain.ts';
export { downsampleMinMax, type DownsampleResult } from './components/charts/downsample.ts';
export { TimeSeriesPane, type TimeSeriesPaneProps } from './components/charts/TimeSeriesPane.tsx';
export type {
  ChartBand,
  ChartLabels,
  ChartSeries,
  DownsampledLine,
  PaneDownsampler,
  PaneSummaryInput,
  RenderStats,
} from './components/charts/types.ts';
export {
  ConfirmDialog,
  type ConfirmDialogProps,
} from './components/ConfirmDialog/ConfirmDialog.tsx';
export { EmptyState, type EmptyStateProps } from './components/EmptyState/EmptyState.tsx';
export { FilterField, type FilterFieldProps } from './components/FilterField/FilterField.tsx';
export { IconButton, type IconButtonProps } from './components/IconButton/IconButton.tsx';
export {
  LiveAnnouncer,
  useAnnounce,
  type Politeness,
} from './components/LiveAnnouncer/LiveAnnouncer.tsx';
export { Panel, type PanelProps } from './components/Panel/Panel.tsx';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './components/SegmentedControl/SegmentedControl.tsx';
export { SourceNote, type SourceNoteProps } from './components/SourceNote/SourceNote.tsx';
export { StatCard, type StatCardProps } from './components/StatCard/StatCard.tsx';
export { StatusChip, type StatusChipProps } from './components/StatusChip/StatusChip.tsx';
export {
  SyntheticBadge,
  type SyntheticBadgeProps,
} from './components/SyntheticBadge/SyntheticBadge.tsx';
export { Toolbar, type ToolbarProps } from './components/Toolbar/Toolbar.tsx';
export {
  nextSort,
  VirtualGrid,
  type GridColumn,
  type GridRow,
  type GridSortDirection,
  type GridSortKey,
  type VirtualGridProps,
} from './components/VirtualGrid/VirtualGrid.tsx';
export { VisuallyHidden } from './components/VisuallyHidden/VisuallyHidden.tsx';
export {
  CHART_SERIES,
  STATUSES,
  type ChartSeriesColor,
  type Status,
  type ThemeMode,
} from './theme/types.ts';
