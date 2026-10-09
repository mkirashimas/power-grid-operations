import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../../test/utils.tsx';
import {
  nextSort,
  VirtualGrid,
  type GridColumn,
  type GridRow,
  type GridSortKey,
} from './VirtualGrid.tsx';

// jsdom has no layout; give elements a size so the virtualizer renders a window of rows.
const originals = {
  height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight'),
  width: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
};
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 960 });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originals.height!);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originals.width!);
});

const COLUMNS: GridColumn[] = [
  { id: 'name', header: 'Asset', width: 160, sortable: true },
  { id: 'mw', header: 'MW', width: 100, align: 'right', sortable: true },
  { id: 'note', header: 'Note', width: 120 },
];

const dataRow = (index: number): GridRow => ({
  kind: 'data',
  cells: [`Asset ${index}`, String(index * 10), 'ok'],
});

const Grid = (props: { rowCount?: number; onSortChange?: (sort: GridSortKey[]) => void }) => {
  const [sort, setSort] = useState<GridSortKey[]>([]);
  return (
    <VirtualGrid
      label="Telemetry rows"
      columns={COLUMNS}
      rowCount={props.rowCount ?? 100_000}
      getRow={dataRow}
      height={400}
      sort={sort}
      onSortChange={(next) => {
        setSort(next);
        props.onSortChange?.(next);
      }}
      empty={<p>No rows</p>}
    />
  );
};

describe('nextSort', () => {
  it('cycles asc → desc → off on one column', () => {
    expect(nextSort([], 'mw', false)).toEqual([{ columnId: 'mw', direction: 'asc' }]);
    expect(nextSort([{ columnId: 'mw', direction: 'asc' }], 'mw', false)).toEqual([
      { columnId: 'mw', direction: 'desc' },
    ]);
    expect(nextSort([{ columnId: 'mw', direction: 'desc' }], 'mw', false)).toEqual([]);
  });

  it('replaces the sort without Shift and adds a key with Shift', () => {
    const byName: GridSortKey[] = [{ columnId: 'name', direction: 'asc' }];
    expect(nextSort(byName, 'mw', false)).toEqual([{ columnId: 'mw', direction: 'asc' }]);
    expect(nextSort(byName, 'mw', true)).toEqual([
      { columnId: 'name', direction: 'asc' },
      { columnId: 'mw', direction: 'asc' },
    ]);
  });
});

describe('VirtualGrid', () => {
  it('exposes the full size to assistive technology but renders only a window of rows', async () => {
    renderWithTheme(<Grid />);

    const grid = screen.getByRole('grid', { name: 'Telemetry rows' });
    expect(grid).toHaveAttribute('aria-rowcount', '100001');
    expect(grid).toHaveAttribute('aria-colcount', '3');
    const rows = within(grid).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.length).toBeLessThan(40);
    expect(rows[1]).toHaveAttribute('aria-rowindex', '2');
    await expectNoAxeViolations();
  });

  it('sorts from the header with mouse and keyboard, reflected in aria-sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    renderWithTheme(<Grid onSortChange={onSortChange} />);

    const mw = screen.getByRole('columnheader', { name: 'MW' });
    expect(mw).toHaveAttribute('aria-sort', 'none');
    await user.click(mw);
    expect(mw).toHaveAttribute('aria-sort', 'ascending');

    mw.focus();
    await user.keyboard('{Enter}');
    expect(mw).toHaveAttribute('aria-sort', 'descending');

    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(screen.getByRole('columnheader', { name: 'Asset' })).toHaveFocus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSortChange).toHaveBeenLastCalledWith([
      { columnId: 'mw', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
  });

  // jsdom cannot scroll, so this grid is small enough to render fully; scrolling a far cell
  // into view is covered by the Playwright tests of the telemetry page.
  it('moves a single focusable cell with the arrow keys, Home/End and Ctrl+End', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Grid rowCount={12} />);

    await user.tab();
    expect(screen.getByRole('columnheader', { name: 'Asset' })).toHaveFocus();
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('gridcell', { name: 'Asset 0' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(screen.getByRole('gridcell', { name: '10' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(document.activeElement).toHaveAttribute('data-cell', '1:2');
    await user.keyboard('{Home}');
    expect(screen.getByRole('gridcell', { name: 'Asset 1' })).toHaveFocus();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(document.activeElement).toHaveAttribute('data-cell', '11:2');
    await user.keyboard('{Control>}{Home}{/Control}');
    expect(screen.getByRole('gridcell', { name: 'Asset 0' })).toHaveFocus();
  });

  it('activates the button in a cell with Enter or Space, keeping one tab stop', async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();
    renderWithTheme(
      <VirtualGrid
        label="Alarms"
        columns={COLUMNS}
        rowCount={3}
        height={400}
        getRow={(index) => ({
          kind: 'data',
          cells: [
            `Asset ${index}`,
            String(index),
            <button key="ack" type="button" tabIndex={-1} onClick={() => onAcknowledge(index)}>
              Acknowledge
            </button>,
          ],
        })}
      />,
    );

    await user.tab();
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
    await user.keyboard('{ArrowDown}{ArrowDown}{End}');
    expect(document.activeElement).toHaveAttribute('data-cell', '1:2');
    await user.keyboard('{Enter}');
    expect(onAcknowledge).toHaveBeenCalledWith(1);
    await user.keyboard('{ArrowUp} ');
    expect(onAcknowledge).toHaveBeenLastCalledWith(0);
    await user.click(screen.getAllByRole('button', { name: 'Acknowledge' })[2]);
    expect(onAcknowledge).toHaveBeenLastCalledWith(2);
  });

  it('shows the empty state under the header when there are no rows', () => {
    renderWithTheme(<Grid rowCount={0} />);
    expect(screen.getByRole('columnheader', { name: 'MW' })).toBeInTheDocument();
    expect(screen.getByText('No rows')).toBeVisible();
  });
});

describe('VirtualGrid groups', () => {
  const Grouped = () => {
    const [expanded, setExpanded] = useState<string[]>([]);
    const rows: GridRow[] = ['coast', 'west'].flatMap((zone): GridRow[] => [
      {
        kind: 'group',
        groupKey: zone,
        label: zone === 'coast' ? 'Coast' : 'West',
        summary: '2 rows',
        expanded: expanded.includes(zone),
      },
      ...(expanded.includes(zone) ? [dataRow(1), dataRow(2)] : []),
    ]);
    return (
      <VirtualGrid
        label="Grouped rows"
        columns={COLUMNS}
        rowCount={rows.length}
        getRow={(index) => rows[index]}
        grouped
        height={400}
        onToggleGroup={(key, open) =>
          setExpanded((current) => (open ? [...current, key] : current.filter((k) => k !== key)))
        }
      />
    );
  };

  it('is a treegrid whose group rows expand and collapse with the keyboard', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Grouped />);

    const grid = screen.getByRole('treegrid', { name: 'Grouped rows' });
    const coast = within(grid).getAllByRole('row')[1];
    expect(coast).toHaveAttribute('aria-expanded', 'false');
    expect(coast).toHaveAttribute('aria-level', '1');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowRight}');
    expect(within(grid).getAllByRole('row')[1]).toHaveAttribute('aria-expanded', 'true');
    expect(within(grid).getAllByRole('row')).toHaveLength(5);
    expect(within(grid).getAllByRole('row')[2]).toHaveAttribute('aria-level', '2');

    await user.keyboard('{ArrowLeft}');
    expect(within(grid).getAllByRole('row')).toHaveLength(3);

    await user.keyboard('{Enter}');
    expect(within(grid).getAllByRole('row')[1]).toHaveAttribute('aria-expanded', 'true');
    await expectNoAxeViolations();
  });
});
