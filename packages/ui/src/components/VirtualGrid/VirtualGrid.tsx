'use client';

import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { Box, type SxProps, type Theme } from '@mui/material';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { computeWindow, scrollTopFor } from './scaledWindow.ts';

export interface GridColumn {
  id: string;
  header: string;
  /** Minimum width in px. The last column also takes any spare width. */
  width: number;
  align?: 'left' | 'right';
  sortable?: boolean;
}

export type GridSortDirection = 'asc' | 'desc';

export interface GridSortKey {
  columnId: string;
  direction: GridSortDirection;
}

export type GridRow =
  | { kind: 'data'; cells: ReactNode[] }
  | {
      kind: 'group';
      /** Passed back to onToggleGroup. */
      groupKey: string;
      label: ReactNode;
      summary?: ReactNode;
      expanded: boolean;
    };

export interface VirtualGridProps {
  /** Accessible name, e.g. "Telemetry rows". */
  label: string;
  columns: GridColumn[];
  rowCount: number;
  /** Returns the row at a position; undefined renders a loading row. */
  getRow: (index: number) => GridRow | undefined;
  sort?: GridSortKey[];
  onSortChange?: (sort: GridSortKey[]) => void;
  onToggleGroup?: (groupKey: string, expanded: boolean) => void;
  /** Rows are grouped: exposes the grid as a treegrid. */
  grouped?: boolean;
  /** CSS height of the scrolling area, e.g. 600 or 'min(70vh, 720px)'. */
  height: number | string;
  rowHeight?: number;
  /** Shown under the header when rowCount is 0. */
  empty?: ReactNode;
  /** Data rows that are selected (single selection, e.g. every row of one asset). */
  isRowSelected?: (index: number) => boolean;
  /**
   * Makes data rows selectable: a click on the row, or Enter / Space on a cell without a
   * button, calls this with the row index.
   */
  onRowSelect?: (index: number) => void;
}

/** Next sort after activating a header: asc → desc → off. Shift (additive) keeps other keys. */
export const nextSort = (
  sort: GridSortKey[],
  columnId: string,
  additive: boolean,
): GridSortKey[] => {
  const current = sort.find((key) => key.columnId === columnId);
  const others = additive ? sort.filter((key) => key.columnId !== columnId) : [];
  if (!current) return [...(additive ? sort : []), { columnId, direction: 'asc' }];
  if (current.direction === 'asc') {
    const next = { columnId, direction: 'desc' as const };
    return additive ? sort.map((key) => (key.columnId === columnId ? next : key)) : [next];
  }
  return others;
};

interface Focus {
  /** -1 is the header row. */
  row: number;
  col: number;
}

const HEADER = -1;

const cellBase: SxProps<Theme> = {
  px: 1.5,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  outline: 'none',
  '&:focus-visible': {
    boxShadow: (theme) => `inset 0 0 0 2px ${(theme.vars || theme).palette.primary.main}`,
  },
};

const stickyFirst: SxProps<Theme> = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
  borderRight: 1,
  borderColor: 'divider',
};

/**
 * An accessible, virtualized data grid: only visible rows are rendered, so it scrolls through
 * millions of rows. Implements the ARIA grid pattern (treegrid when grouped) with a single
 * focusable cell, moved with arrow keys, Home/End, Ctrl+Home/End and PageUp/PageDown.
 */
export const VirtualGrid = ({
  label,
  columns,
  rowCount,
  getRow,
  sort = [],
  onSortChange,
  onToggleGroup,
  grouped = false,
  height,
  rowHeight = 40,
  empty,
  isRowSelected,
  onRowSelect,
}: VirtualGridProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [storedFocus, setFocus] = useState<Focus>({ row: HEADER, col: 0 });
  // Set when focus moves by keyboard, so the new cell receives DOM focus after rendering.
  const pendingFocus = useRef(false);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(typeof height === 'number' ? height : 600);
  // The sticky header takes one row of the scroll container.
  const viewport = Math.max(rowHeight, viewportHeight - rowHeight);
  const rows = computeWindow({ rowCount, rowHeight, viewport, scrollTop, overscan: 8 });

  // Track the container height; the observer reports the initial size when it starts.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const template = columns
    .map((column, i) =>
      i === columns.length - 1 ? `minmax(${column.width}px, 1fr)` : `${column.width}px`,
    )
    .join(' ');
  const minWidth = columns.reduce((total, column) => total + column.width, 0);
  const lastRow = rowCount - 1;
  const lastCol = columns.length - 1;
  const pageSize = Math.max(1, Math.floor(viewport / rowHeight) - 1);

  // Derived, so the focused cell stays valid when the data shrinks.
  const focus: Focus = { row: Math.min(storedFocus.row, lastRow), col: storedFocus.col };

  const focusCell = useCallback(
    (next: Focus) => {
      pendingFocus.current = true;
      setFocus(next);
      const element = scrollRef.current;
      if (next.row < 0 || !element) return;
      const target = scrollTopFor(next.row, {
        rowCount,
        rowHeight,
        viewport,
        scrollTop: element.scrollTop,
        overscan: 0,
      });
      if (target !== undefined) element.scrollTop = target;
    },
    [rowCount, rowHeight, viewport],
  );

  // After a keyboard move, focus the cell once it is rendered (scrolling may render it later).
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    let frame = 0;
    let attempts = 0;
    const tryFocus = () => {
      const col = focus.row >= 0 && getRow(focus.row)?.kind === 'group' ? 0 : focus.col;
      const cell = scrollRef.current?.querySelector<HTMLElement>(
        `[data-cell="${focus.row}:${col}"]`,
      );
      if (cell) {
        // The grid already scrolled the row into its viewport; this also brings the cell into
        // the page viewport and scrolls narrow grids sideways.
        cell.focus();
        pendingFocus.current = false;
      } else if (attempts < 10) {
        attempts += 1;
        frame = requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
    return () => cancelAnimationFrame(frame);
  });

  const toggleSort = (columnId: string, additive: boolean) =>
    onSortChange?.(nextSort(sort, columnId, additive));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { row, col } = focus;
    const groupRow = row >= 0 ? getRow(row) : undefined;
    const isGroup = groupRow?.kind === 'group';
    const ctrl = event.ctrlKey || event.metaKey;
    const go = (next: Focus) => {
      event.preventDefault();
      focusCell({
        row: Math.max(HEADER, Math.min(lastRow, next.row)),
        col: Math.max(0, Math.min(lastCol, next.col)),
      });
    };
    switch (event.key) {
      case 'ArrowDown':
        return go({ row: row + 1, col });
      case 'ArrowUp':
        return go({ row: row - 1, col });
      case 'ArrowRight':
        if (isGroup) {
          event.preventDefault();
          if (!groupRow.expanded) onToggleGroup?.(groupRow.groupKey, true);
          return;
        }
        return go({ row, col: col + 1 });
      case 'ArrowLeft':
        if (isGroup) {
          event.preventDefault();
          if (groupRow.expanded) onToggleGroup?.(groupRow.groupKey, false);
          return;
        }
        return go({ row, col: col - 1 });
      case 'Home':
        return go(ctrl ? { row: Math.min(0, lastRow), col: 0 } : { row, col: 0 });
      case 'End':
        return go(ctrl ? { row: lastRow, col: lastCol } : { row, col: lastCol });
      case 'PageDown':
        return go({ row: Math.max(row, 0) + pageSize, col });
      case 'PageUp':
        return go({ row: Math.max(0, row - pageSize), col });
      case 'Enter':
      case ' ':
        if (row === HEADER && columns[col]?.sortable) {
          event.preventDefault();
          toggleSort(columns[col].id, event.shiftKey);
        } else if (isGroup) {
          event.preventDefault();
          onToggleGroup?.(groupRow.groupKey, !groupRow.expanded);
        } else if (row >= 0) {
          // A cell holding one control (e.g. an "Acknowledge" button) activates it.
          const widget = scrollRef.current?.querySelector<HTMLElement>(
            `[data-cell="${row}:${col}"] button, [data-cell="${row}:${col}"] a[href]`,
          );
          if (widget && event.target !== widget) {
            event.preventDefault();
            widget.click();
          } else if (!widget && onRowSelect && groupRow?.kind === 'data') {
            event.preventDefault();
            onRowSelect(row);
          }
        }
        return;
      default:
    }
  };

  // Clicking or tabbing into a cell makes it the focused cell.
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const [row, col] = (event.target.dataset.cell ?? '').split(':').map(Number);
    if (
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      (row !== focus.row || col !== focus.col)
    ) {
      const isGroup = row >= 0 && getRow(row)?.kind === 'group';
      setFocus({ row, col: isGroup ? focus.col : col });
    }
  };

  const tabIndexOf = (row: number, col: number) =>
    row === focus.row && (col === focus.col || (row >= 0 && getRow(row)?.kind === 'group'))
      ? 0
      : -1;

  const primary = sort[0];
  const rowSx: SxProps<Theme> = {
    display: 'grid',
    gridTemplateColumns: template,
    minWidth,
    height: rowHeight,
    borderBottom: 1,
    borderColor: 'divider',
  };

  return (
    <Box
      ref={scrollRef}
      role={grouped ? 'treegrid' : 'grid'}
      aria-label={label}
      aria-rowcount={rowCount + 1}
      aria-colcount={columns.length}
      aria-multiselectable={onRowSelect ? false : undefined}
      onKeyDown={handleKeyDown}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onFocus={handleFocus}
      sx={{
        height,
        overflow: 'auto',
        position: 'relative',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        typography: 'body2',
        // Keep keyboard scrolling inside the grid instead of the page.
        overscrollBehavior: 'contain',
      }}
    >
      <Box
        role="rowgroup"
        sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper' }}
      >
        <Box role="row" aria-rowindex={1} sx={rowSx}>
          {columns.map((column, col) => {
            const sorted = sort.findIndex((key) => key.columnId === column.id);
            const direction = sorted >= 0 ? sort[sorted].direction : undefined;
            return (
              <Box
                key={column.id}
                role="columnheader"
                aria-colindex={col + 1}
                aria-sort={
                  column.sortable
                    ? primary?.columnId === column.id
                      ? primary.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
                tabIndex={tabIndexOf(HEADER, col)}
                data-cell={`${HEADER}:${col}`}
                onClick={
                  column.sortable ? (event) => toggleSort(column.id, event.shiftKey) : undefined
                }
                sx={[
                  cellBase,
                  {
                    gap: 0.5,
                    fontWeight: 600,
                    color: 'text.secondary',
                    justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                    cursor: column.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    '&:hover': column.sortable ? { color: 'text.primary' } : undefined,
                  },
                  col === 0 ? stickyFirst : {},
                ]}
              >
                {column.header}
                {direction &&
                  (direction === 'asc' ? (
                    <ArrowUpwardRounded fontSize="inherit" aria-hidden />
                  ) : (
                    <ArrowDownwardRounded fontSize="inherit" aria-hidden />
                  ))}
                {direction && sort.length > 1 && (
                  <Box component="span" aria-hidden sx={{ typography: 'caption' }}>
                    {sorted + 1}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {rowCount === 0 ? (
        empty
      ) : (
        <Box role="rowgroup" sx={{ position: 'relative', height: rows.scrollHeight }}>
          {Array.from({ length: rows.end - rows.start }, (_, i) => rows.start + i).map((index) => {
            const row = getRow(index);
            const position = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${rows.offsetOf(index)}px)`,
            } as const;

            if (row?.kind === 'group') {
              return (
                <Box
                  key={`g:${row.groupKey}`}
                  role="row"
                  aria-rowindex={index + 2}
                  aria-level={1}
                  aria-expanded={row.expanded}
                  sx={[rowSx, position, { bgcolor: 'action.hover' }]}
                >
                  <Box
                    role="gridcell"
                    aria-colspan={columns.length}
                    tabIndex={tabIndexOf(index, 0)}
                    data-cell={`${index}:0`}
                    onClick={() => onToggleGroup?.(row.groupKey, !row.expanded)}
                    sx={[
                      cellBase,
                      { gridColumn: '1 / -1', gap: 1, cursor: 'pointer', fontWeight: 600 },
                    ]}
                  >
                    <ChevronRightRounded
                      fontSize="small"
                      aria-hidden
                      sx={{ transform: row.expanded ? 'rotate(90deg)' : 'none' }}
                    />
                    <Box component="span" sx={{ position: 'sticky', left: 0 }}>
                      {row.label}
                    </Box>
                    {row.summary && (
                      <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                        {row.summary}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            }

            const selectable = Boolean(onRowSelect && row);
            const selected = selectable && (isRowSelected?.(index) ?? false);
            return (
              <Box
                key={index}
                role="row"
                aria-rowindex={index + 2}
                aria-level={grouped ? 2 : undefined}
                aria-busy={row ? undefined : true}
                aria-selected={selectable ? selected : undefined}
                onClick={
                  selectable
                    ? (event) => {
                        // A button or link inside a cell does its own thing.
                        if ((event.target as HTMLElement).closest('button, a[href]')) return;
                        onRowSelect?.(index);
                      }
                    : undefined
                }
                sx={[
                  rowSx,
                  position,
                  { '&:hover > *': { bgcolor: 'action.hover' } },
                  selectable ? { cursor: 'pointer' } : {},
                  selected
                    ? (theme) => {
                        const tint = (theme.vars || theme).palette.action.selected;
                        return {
                          // An overlay keeps the sticky first cell opaque while tinting it.
                          '& > *': { backgroundImage: `linear-gradient(${tint}, ${tint})` },
                          // A bar on the left, so selection does not rely on colour alone.
                          '& > :first-of-type': {
                            boxShadow: `inset 3px 0 0 ${(theme.vars || theme).palette.primary.main}`,
                          },
                        };
                      }
                    : {},
                ]}
              >
                {columns.map((column, col) => (
                  <Box
                    key={column.id}
                    role="gridcell"
                    aria-colindex={col + 1}
                    tabIndex={tabIndexOf(index, col)}
                    data-cell={`${index}:${col}`}
                    sx={[
                      cellBase,
                      {
                        justifyContent: column.align === 'right' ? 'flex-end' : 'flex-start',
                        fontVariantNumeric: 'tabular-nums',
                      },
                      col === 0 ? stickyFirst : {},
                    ]}
                  >
                    {row?.cells[col]}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};
