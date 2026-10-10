'use client';

import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import {
  ASSET_KINDS,
  statusOf,
  TELEMETRY_STATUSES,
  WEATHER_ZONES,
  type Asset,
  type HourlyPoint,
} from '@pgo/grid-model';
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  EmptyState,
  FilterField,
  Panel,
  StatusChip,
  SyntheticBadge,
  Toolbar,
  useAnnounce,
  VirtualGrid,
  type GridColumn,
  type GridRow,
  type GridSortKey,
} from '@pgo/ui';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectAsset, selectSelectedAssetId } from '../../../store/selectionSlice';
import {
  COLUMN_IDS,
  GROUP_BY_OPTIONS,
  groupPosition,
  isGroupMarker,
  type ColumnId,
  type GroupBy,
  type TelemetryFilters,
} from '../engine/types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useQueryUrlSync } from '../hooks/useQueryUrlSync';
import { useTelemetryWorker } from '../hooks/useTelemetryWorker';
import { TELEMETRY_NAMESPACE } from '../i18n';
import {
  resetFilters,
  selectQuery,
  setExpanded,
  setFilter,
  setGroupBy,
  setGroupExpanded,
  setSort,
} from '../slice';
import { SelectedAssetChart } from './SelectedAssetChart';

const COLUMN_WIDTHS: Record<ColumnId, number> = {
  asset: 200,
  kind: 120,
  zone: 140,
  time: 150,
  mw: 100,
  loading: 110,
  voltage: 120,
  status: 140,
};

const NUMERIC: ColumnId[] = ['mw', 'loading', 'voltage'];

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
}

const SelectField = <T extends string>({
  label,
  value,
  options,
  optionLabel,
  onChange,
}: SelectFieldProps<T>) => (
  <TextField
    select
    size="small"
    label={label}
    value={value}
    onChange={(event) => onChange(event.target.value as T)}
    sx={{ minWidth: 150 }}
  >
    {options.map((option) => (
      <MenuItem key={option} value={option}>
        {optionLabel(option)}
      </MenuItem>
    ))}
  </TextField>
);

interface TelemetryViewProps {
  demand: HourlyPoint[];
  seed: number;
}

export const TelemetryView = ({ demand, seed }: TelemetryViewProps) => {
  const { t, i18n } = useTranslation(TELEMETRY_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const dispatch = useAppDispatch();
  const announce = useAnnounce();
  const query = useAppSelector(selectQuery);
  const selectedId = useAppSelector(selectSelectedAssetId);
  useQueryUrlSync();

  // Typing in the filter waits for a pause before querying; other changes apply at once.
  const text = useDebouncedValue(query.filters.text, 250);
  const workerQuery = useMemo(
    () => ({ ...query, filters: { ...query.filters, text } }),
    [query, text],
  );
  const state = useTelemetryWorker(demand, seed, workerQuery);
  const ready = state.status === 'ready' ? state : undefined;
  const result = ready?.result;

  const formats = useMemo(
    () => ({
      count: new Intl.NumberFormat(language),
      mw: new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      voltage: new Intl.NumberFormat(language, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
      ms: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
      // ERCOT operates on Central Time.
      time: new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Chicago',
      }),
    }),
    [language],
  );

  const assetsById = useMemo(
    () => new Map<string, Asset>(ready?.assets.map((asset) => [asset.id, asset]) ?? []),
    [ready?.assets],
  );
  const expanded = useMemo(() => new Set(query.expanded), [query.expanded]);
  const selectedAsset = selectedId ? assetsById.get(selectedId) : undefined;

  // Linked selection: a row selects its asset, and every row of that asset is highlighted.
  const rowAssetIndex = (index: number) => {
    const value = result?.order[index];
    return ready && value !== undefined && !isGroupMarker(value)
      ? ready.columns.assetIndex[value]
      : undefined;
  };
  const isRowSelected = (index: number) =>
    selectedAsset !== undefined && rowAssetIndex(index) === selectedAsset.index;
  const onRowSelect = (index: number) => {
    const assetIndex = rowAssetIndex(index);
    if (ready && assetIndex !== undefined) dispatch(selectAsset(ready.assets[assetIndex].id));
  };

  const matched = result?.matchedRows;
  useEffect(() => {
    if (matched !== undefined) {
      announce(t('readout.announce', { matched: formats.count.format(matched) }));
    }
  }, [matched, announce, t, formats]);

  const columns: GridColumn[] = COLUMN_IDS.map((id) => ({
    id,
    header: t(`columns.${id}`),
    width: COLUMN_WIDTHS[id],
    align: NUMERIC.includes(id) ? 'right' : 'left',
    sortable: true,
  }));

  const groupLabel = (groupBy: GroupBy, key: string) => {
    switch (groupBy) {
      case 'kind':
        return t(`kinds.${key}`);
      case 'zone':
        return t(`zones.${key}`);
      case 'status':
        return t(`statuses.${key}`);
      default:
        return assetsById.get(key)?.name ?? key;
    }
  };

  const getRow = (index: number): GridRow | undefined => {
    if (!ready || !result) return undefined;
    const value = result.order[index];
    if (isGroupMarker(value)) {
      const group = result.groups[groupPosition(value)];
      return {
        kind: 'group',
        groupKey: group.key,
        expanded: expanded.has(group.key),
        label: groupLabel(query.groupBy, group.key),
        summary: (
          <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
            <span>
              {t('groupSummary', {
                count: formats.count.format(group.count),
                avg: formats.mw.format(group.avgMw),
                max: formats.mw.format(group.maxMw),
                loading: formats.mw.format(group.maxLoadingPct),
              })}
            </span>
            <StatusChip status={group.worstStatus} label={t(`statuses.${group.worstStatus}`)} />
          </Stack>
        ),
      };
    }
    const { columns: data, assets } = ready;
    const asset = assets[data.assetIndex[value]];
    const status = statusOf(data.loadingPct[value], data.voltagePu[value]);
    return {
      kind: 'data',
      cells: [
        asset.name,
        t(`kinds.${asset.kind}`),
        t(`zones.${asset.zone}`),
        formats.time.format(data.timestamp[value]),
        formats.mw.format(data.mw[value]),
        formats.mw.format(data.loadingPct[value]),
        formats.voltage.format(data.voltagePu[value]),
        <StatusChip key="status" status={status} label={t(`statuses.${status}`)} />,
      ],
    };
  };

  const filter = <K extends keyof TelemetryFilters>(key: K) => ({
    value: query.filters[key],
    onChange: (value: TelemetryFilters[K]) => dispatch(setFilter({ key, value })),
  });

  const sort: GridSortKey[] = query.sort.map(({ column, direction }) => ({
    columnId: column,
    direction,
  }));

  const timings = result
    ? [
        ['generate', ready!.generateMs],
        ['filter', result.timings.filterMs],
        ['sort', result.timings.sortMs],
        ['group', result.timings.groupMs],
      ]
        .map(([key, ms]) => t(`readout.${key}`, { ms: formats.ms.format(ms as number) }))
        .join(' · ')
    : '';

  return (
    <Stack spacing={3}>
      <Panel title={t('title')} actions={<SyntheticBadge label={t('synthetic')} />}>
        <Stack spacing={2}>
          <Toolbar label={t('filters.label')}>
            <FilterField
              label={t('filters.asset')}
              placeholder={t('filters.assetPlaceholder')}
              clearLabel={t('filters.clear')}
              {...filter('text')}
            />
            <SelectField
              label={t('filters.kind')}
              options={['all', ...ASSET_KINDS] as const}
              optionLabel={(o) => (o === 'all' ? t('filters.all') : t(`kinds.${o}`))}
              {...filter('kind')}
            />
            <SelectField
              label={t('filters.zone')}
              options={['all', ...WEATHER_ZONES] as const}
              optionLabel={(o) => (o === 'all' ? t('filters.all') : t(`zones.${o}`))}
              {...filter('zone')}
            />
            <SelectField
              label={t('filters.status')}
              options={['all', ...TELEMETRY_STATUSES] as const}
              optionLabel={(o) => (o === 'all' ? t('filters.all') : t(`statuses.${o}`))}
              {...filter('status')}
            />
            <SelectField
              label={t('filters.groupBy')}
              options={GROUP_BY_OPTIONS}
              optionLabel={(o) => t(`filters.groupOptions.${o}`)}
              value={query.groupBy}
              onChange={(value) => dispatch(setGroupBy(value))}
            />
            {query.groupBy !== 'none' && result && (
              <>
                <Button
                  size="small"
                  onClick={() => dispatch(setExpanded(result.groups.map((group) => group.key)))}
                >
                  {t('filters.expandAll')}
                </Button>
                <Button size="small" onClick={() => dispatch(setExpanded([]))}>
                  {t('filters.collapseAll')}
                </Button>
              </>
            )}
          </Toolbar>

          <Box sx={{ minHeight: 24 }}>
            {result && ready ? (
              <Typography variant="body2" color="text.secondary" data-testid="telemetry-readout">
                <strong>
                  {t('readout.rows', {
                    matched: formats.count.format(result.matchedRows),
                    total: formats.count.format(ready.columns.length),
                  })}
                </strong>
                {' · '}
                {ready.pending ? t('readout.updating') : timings}
              </Typography>
            ) : null}
          </Box>

          {state.status === 'error' ? (
            <Alert severity="error">{t('error', { message: state.message })}</Alert>
          ) : !result ? (
            <Stack spacing={1} sx={{ py: 6, alignItems: 'center' }}>
              <Typography color="text.secondary">{t('loading')}</Typography>
              <LinearProgress sx={{ width: '60%' }} aria-label={t('loading')} />
            </Stack>
          ) : (
            <VirtualGrid
              label={t('gridLabel')}
              columns={columns}
              rowCount={result.order.length}
              getRow={getRow}
              grouped={query.groupBy !== 'none'}
              sort={sort}
              onSortChange={(next) =>
                dispatch(
                  setSort(
                    next.map(({ columnId, direction }) => ({
                      column: columnId as ColumnId,
                      direction,
                    })),
                  ),
                )
              }
              onToggleGroup={(key, open) => dispatch(setGroupExpanded({ key, expanded: open }))}
              isRowSelected={isRowSelected}
              onRowSelect={onRowSelect}
              height="min(70vh, 720px)"
              empty={
                <EmptyState
                  icon={<FilterAltOffOutlined />}
                  title={t('empty.title')}
                  body={t('empty.body')}
                  action={
                    <Button variant="outlined" onClick={() => dispatch(resetFilters())}>
                      {t('filters.reset')}
                    </Button>
                  }
                />
              }
            />
          )}
        </Stack>
      </Panel>
      {ready && selectedAsset && (
        <SelectedAssetChart asset={selectedAsset} columns={ready.columns} />
      )}
    </Stack>
  );
};
