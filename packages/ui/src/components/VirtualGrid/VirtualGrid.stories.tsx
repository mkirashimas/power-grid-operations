import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { StatusChip } from '../StatusChip/StatusChip.tsx';
import {
  VirtualGrid,
  type GridColumn,
  type GridRow,
  type GridSortKey,
  type VirtualGridProps,
} from './VirtualGrid.tsx';

const ZONES = [
  'Coast',
  'East',
  'Far West',
  'North',
  'North Central',
  'South Central',
  'Southern',
  'West',
];
const ROWS = 100_000;

const COLUMNS: GridColumn[] = [
  { id: 'asset', header: 'Asset', width: 180, sortable: true },
  { id: 'zone', header: 'Zone', width: 140, sortable: true },
  { id: 'mw', header: 'MW', width: 110, align: 'right', sortable: true },
  { id: 'loading', header: 'Loading %', width: 120, align: 'right', sortable: true },
  { id: 'status', header: 'Status', width: 150 },
];

// Deterministic sample data, computed on demand: nothing is stored per row.
const sample = (index: number) => {
  const loading = (index * 37) % 115;
  return {
    asset: `Asset ${String(index).padStart(6, '0')}`,
    zone: ZONES[index % ZONES.length],
    mw: ((index * 7919) % 1000) / 2,
    loading,
  };
};

const toRow = (index: number): GridRow => {
  const { asset, zone, mw, loading } = sample(index);
  const status = loading >= 100 ? 'alarm' : loading >= 90 ? 'warning' : 'normal';
  return {
    kind: 'data',
    cells: [
      asset,
      zone,
      mw.toFixed(1),
      loading.toFixed(0),
      <StatusChip key="s" status={status} label={status[0].toUpperCase() + status.slice(1)} />,
    ],
  };
};

const meta = {
  title: 'Components/VirtualGrid',
  component: VirtualGrid,
  args: {
    label: 'Telemetry rows',
    columns: COLUMNS,
    rowCount: ROWS,
    getRow: toRow,
    height: 480,
  },
} satisfies Meta<typeof VirtualGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 100,000 rows; only the visible ones are in the DOM. Try arrow keys, PageDown and Ctrl+End. */
export const HundredThousandRows: Story = {};

const SortableGrid = (args: VirtualGridProps) => {
  const [sort, setSort] = useState<GridSortKey[]>([{ columnId: 'mw', direction: 'desc' }]);
  const order = useMemo(() => {
    const indices = Array.from({ length: 5_000 }, (_, i) => i);
    return indices.sort((a, b) => {
      for (const { columnId, direction } of sort) {
        const [x, y] = [sample(a), sample(b)] as Record<string, string | number>[];
        const difference =
          typeof x[columnId] === 'number'
            ? (x[columnId] as number) - (y[columnId] as number)
            : String(x[columnId]).localeCompare(String(y[columnId]));
        if (difference !== 0) return direction === 'asc' ? difference : -difference;
      }
      return a - b;
    });
  }, [sort]);
  return (
    <VirtualGrid
      {...args}
      rowCount={order.length}
      getRow={(index) => toRow(order[index])}
      sort={sort}
      onSortChange={setSort}
    />
  );
};

/** Click a header (or Enter on it) to cycle asc → desc → off; Shift adds a secondary sort. */
export const Sortable: Story = { render: (args) => <SortableGrid {...args} /> };

const GroupedGrid = (args: VirtualGridProps) => {
  const [expanded, setExpanded] = useState<string[]>(['Coast']);
  const rows = useMemo(
    () =>
      ZONES.flatMap((zone): GridRow[] => {
        const members = Array.from(
          { length: 250 },
          (_, i) => i * ZONES.length + ZONES.indexOf(zone),
        );
        return [
          {
            kind: 'group',
            groupKey: zone,
            label: zone,
            summary: `${members.length} rows`,
            expanded: expanded.includes(zone),
          },
          ...(expanded.includes(zone) ? members.map(toRow) : []),
        ];
      }),
    [expanded],
  );
  return (
    <VirtualGrid
      {...args}
      grouped
      rowCount={rows.length}
      getRow={(index) => rows[index]}
      onToggleGroup={(key, open) =>
        setExpanded((current) => (open ? [...current, key] : current.filter((k) => k !== key)))
      }
    />
  );
};

/** A treegrid: group rows expand with Enter, Space or →, and collapse with ←. */
export const Grouped: Story = { render: (args) => <GroupedGrid {...args} /> };

export const Empty: Story = {
  args: {
    rowCount: 0,
    empty: <p style={{ padding: 16 }}>No rows match these filters.</p>,
  },
};

const SelectableGrid = (args: VirtualGridProps) => {
  // Rows of one zone belong together, like the rows of one asset in the telemetry table.
  const [zone, setZone] = useState<string | null>(ZONES[1]);
  return (
    <VirtualGrid
      {...args}
      isRowSelected={(index) => sample(index).zone === zone}
      onRowSelect={(index) => setZone(sample(index).zone)}
    />
  );
};

/** Click a row, or press Space or Enter on it, to select it and every row of its zone. */
export const Selectable: Story = { render: (args) => <SelectableGrid {...args} /> };
