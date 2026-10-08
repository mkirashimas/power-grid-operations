import type {
  Asset,
  AssetKind,
  TelemetryColumns,
  TelemetryStatus,
  WeatherZone,
} from '@pgo/grid-model';

export const COLUMN_IDS = [
  'asset',
  'kind',
  'zone',
  'time',
  'mw',
  'loading',
  'voltage',
  'status',
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export type SortDirection = 'asc' | 'desc';

export interface SortKey {
  column: ColumnId;
  direction: SortDirection;
}

export const GROUP_BY_OPTIONS = ['none', 'kind', 'zone', 'asset', 'status'] as const;

export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];

export interface TelemetryFilters {
  /** Case-insensitive match on asset name or id. */
  text: string;
  kind: AssetKind | 'all';
  zone: WeatherZone | 'all';
  status: TelemetryStatus | 'all';
}

export interface TelemetryQuery {
  filters: TelemetryFilters;
  /** Primary key first. Rows keep their natural order (asset, then time) on ties. */
  sort: SortKey[];
  groupBy: GroupBy;
  /** Keys of expanded groups; groups start collapsed. */
  expanded: string[];
}

/** The generated data plus per-asset and per-row keys precomputed for fast queries. */
export interface TelemetryDataset {
  assets: Asset[];
  columns: TelemetryColumns;
  /** Status severity per row: 0 normal, 1 warning, 2 alarm. */
  severity: Uint8Array;
  /** Per asset: position when sorted by name, and the index of its kind and zone. */
  assetNameRank: Uint16Array;
  kindIndex: Uint8Array;
  zoneIndex: Uint8Array;
}

export interface GroupSummary {
  /** Stable key: the kind, zone, asset id or status. */
  key: string;
  count: number;
  avgMw: number;
  maxMw: number;
  maxLoadingPct: number;
  worstStatus: TelemetryStatus;
}

export interface QueryTimings {
  filterMs: number;
  sortMs: number;
  groupMs: number;
}

/**
 * Display rows hold a row index, or GROUP_FLAG + group position for a group header.
 * Arithmetic rather than bitwise: JS bitwise operators are signed 32-bit.
 */
export const GROUP_FLAG = 0x8000_0000;

export const groupMarker = (position: number) => GROUP_FLAG + position;

export const isGroupMarker = (value: number) => value >= GROUP_FLAG;

export const groupPosition = (value: number) => value - GROUP_FLAG;

export interface QueryResult {
  order: Uint32Array;
  groups: GroupSummary[];
  matchedRows: number;
  timings: QueryTimings;
}
