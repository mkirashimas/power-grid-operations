'use client';

import { statusOf, type Asset } from '@pgo/grid-model';
import { StatusChip, VirtualGrid, type GridColumn, type GridRow, type GridSortKey } from '@pgo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { MAP_NAMESPACE } from '../i18n';

/**
 * Every asset with its live values: the accessible alternative to the map canvas. Rows are
 * selectable (linked selection), and sorting by loading keeps the worst assets on top as values
 * change.
 */
export const AssetTable = ({
  assets,
  loading,
  voltage,
  selectedIndex,
  onSelect,
}: {
  assets: readonly Asset[];
  loading: readonly number[];
  voltage: readonly number[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) => {
  const { t, i18n } = useTranslation(MAP_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const [sort, setSort] = useState<GridSortKey[]>([{ columnId: 'loading', direction: 'desc' }]);

  const formats = useMemo(
    () => ({
      pct: new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      pu: new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    }),
    [language],
  );

  const order = useMemo(() => {
    const indexes = assets.map((asset) => asset.index);
    const [key] = sort;
    if (!key) return indexes;
    const value = (index: number) =>
      key.columnId === 'loading'
        ? (loading[index] ?? -Infinity)
        : key.columnId === 'voltage'
          ? (voltage[index] ?? -Infinity)
          : 0;
    const sign = key.direction === 'asc' ? 1 : -1;
    return indexes.sort((a, b) =>
      key.columnId === 'asset'
        ? sign * assets[a].name.localeCompare(assets[b].name)
        : sign * (value(a) - value(b)) || a - b,
    );
  }, [assets, loading, voltage, sort]);

  const columns: GridColumn[] = [
    { id: 'asset', header: t('table.asset'), width: 200, sortable: true },
    { id: 'kind', header: t('table.kind'), width: 130 },
    { id: 'zone', header: t('table.zone'), width: 140 },
    { id: 'loading', header: t('table.loading'), width: 110, align: 'right', sortable: true },
    { id: 'voltage', header: t('table.voltage'), width: 110, align: 'right', sortable: true },
    { id: 'status', header: t('table.status'), width: 130 },
  ];

  const getRow = (position: number): GridRow | undefined => {
    const index = order[position];
    const asset = assets[index];
    if (!asset) return undefined;
    const l = loading[index];
    const v = voltage[index];
    const status = l === undefined || v === undefined ? undefined : statusOf(l, v);
    return {
      kind: 'data',
      cells: [
        asset.name,
        t(`kinds.${asset.kind}`),
        t(`zones.${asset.zone}`),
        l === undefined ? '–' : t('units.pct', { value: formats.pct.format(l) }),
        v === undefined ? '–' : t('units.pu', { value: formats.pu.format(v) }),
        status ? <StatusChip key="status" status={status} label={t(`legend.${status}`)} /> : '–',
      ],
    };
  };

  return (
    <VirtualGrid
      label={t('table.label')}
      columns={columns}
      rowCount={order.length}
      getRow={getRow}
      sort={sort}
      onSortChange={(next) => setSort(next.slice(0, 1))}
      height="min(60vh, 520px)"
      isRowSelected={(position) => order[position] === selectedIndex}
      onRowSelect={(position) => onSelect(order[position])}
    />
  );
};
