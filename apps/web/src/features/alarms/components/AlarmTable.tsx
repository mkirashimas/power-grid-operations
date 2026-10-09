'use client';

import { WEATHER_ZONES, type LiveAlarm } from '@pgo/grid-model';
import { StatusChip, Toolbar, VirtualGrid, type GridColumn, type GridRow } from '@pgo/ui';
import {
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectAsset, selectSelectedAssetId } from '../../../store/selectionSlice';
import { useAcknowledgeAlarmMutation } from '../../../store/live/liveApi';
import { ALARMS_NAMESPACE } from '../i18n';
import { filterAlarms, type SeverityFilter, type ZoneFilter } from '../live';
import { selectFilters, setSeverity, setZone } from '../slice';

const TIME_ZONE = 'America/Chicago';
const SEVERITY_OPTIONS: readonly SeverityFilter[] = ['all', 'alarm', 'warning'];
const ZONE_OPTIONS: readonly ZoneFilter[] = ['all', ...WEATHER_ZONES];

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

/**
 * Alarms, newest first, filtered by severity and zone. Pause freezes the rows (their state
 * and acknowledgements still update); Acknowledge goes to the server, which tells every client.
 */
export const AlarmTable = ({ url, alarms }: { url: string; alarms: LiveAlarm[] }) => {
  const { t, i18n } = useTranslation(ALARMS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const dispatch = useAppDispatch();
  const { severity, zone } = useAppSelector(selectFilters);
  const [acknowledge] = useAcknowledgeAlarmMutation();
  // Ids shown while paused, in their order at the moment of pausing.
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null);
  const selectedId = useAppSelector(selectSelectedAssetId);
  const [onlySelected, setOnlySelected] = useState(false);
  const showOnlySelected = onlySelected && selectedId !== null;

  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: TIME_ZONE,
      }),
      pct: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
      pu: new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    }),
    [language],
  );

  const rows = useMemo(() => {
    const filtered = filterAlarms(alarms, severity, zone).filter(
      (alarm) => !showOnlySelected || alarm.assetId === selectedId,
    );
    if (!frozenIds) return filtered;
    const byId = new Map(filtered.map((alarm) => [alarm.id, alarm]));
    return frozenIds.flatMap((id) => byId.get(id) ?? []);
  }, [alarms, severity, zone, frozenIds, showOnlySelected, selectedId]);

  const togglePause = () =>
    setFrozenIds((current) => (current ? null : alarms.map((alarm) => alarm.id)));

  const columns: GridColumn[] = [
    { id: 'raised', header: t('table.raised'), width: 110 },
    { id: 'severity', header: t('table.severity'), width: 140 },
    { id: 'asset', header: t('table.asset'), width: 220 },
    { id: 'zone', header: t('table.zone'), width: 140 },
    { id: 'condition', header: t('table.condition'), width: 150 },
    { id: 'value', header: t('table.value'), width: 100, align: 'right' },
    { id: 'state', header: t('table.state'), width: 170 },
    { id: 'acknowledged', header: t('table.acknowledged'), width: 170 },
  ];

  const value = (alarm: LiveAlarm) =>
    alarm.condition === 'overload'
      ? t('units.pct', { value: formats.pct.format(alarm.value) })
      : t('units.pu', { value: formats.pu.format(alarm.value) });

  const getRow = (index: number): GridRow | undefined => {
    const alarm = rows[index];
    if (!alarm) return undefined;
    return {
      kind: 'data',
      cells: [
        formats.time.format(alarm.raisedAt),
        <StatusChip
          key="severity"
          status={alarm.severity}
          label={t(`severities.${alarm.severity}`)}
        />,
        `${alarm.assetName} · ${t(`kinds.${alarm.kind}`)}`,
        t(`zones.${alarm.zone}`),
        t(`conditions.${alarm.condition}`),
        value(alarm),
        alarm.clearedAt === null
          ? t('states.active')
          : t('states.cleared', { time: formats.time.format(alarm.clearedAt) }),
        alarm.acknowledgedAt === null ? (
          <Button
            key="ack"
            size="small"
            variant="outlined"
            // The grid owns keyboard focus: Enter or Space on the cell presses the button.
            tabIndex={-1}
            aria-label={t('acknowledgeLabel', { id: alarm.id, asset: alarm.assetName })}
            onClick={() => acknowledge({ url, id: alarm.id })}
          >
            {t('acknowledge')}
          </Button>
        ) : (
          formats.time.format(alarm.acknowledgedAt)
        ),
      ],
    };
  };

  return (
    <Stack spacing={1.5}>
      <Toolbar label={t('filters.label')}>
        <SelectField
          label={t('filters.severity')}
          options={SEVERITY_OPTIONS}
          optionLabel={(o) => (o === 'all' ? t('filters.all') : t(`filters.${o}`))}
          value={severity}
          onChange={(next) => dispatch(setSeverity(next))}
        />
        <SelectField
          label={t('filters.zone')}
          options={ZONE_OPTIONS}
          optionLabel={(o) => (o === 'all' ? t('filters.allZones') : t(`zones.${o}`))}
          value={zone}
          onChange={(next) => dispatch(setZone(next))}
        />
        <FormControlLabel
          control={
            <Switch
              checked={showOnlySelected}
              disabled={selectedId === null}
              onChange={(event) => setOnlySelected(event.target.checked)}
            />
          }
          label={t('selected.only')}
        />
        <Button
          variant={frozenIds ? 'contained' : 'outlined'}
          aria-pressed={frozenIds !== null}
          onClick={togglePause}
        >
          {frozenIds ? t('resume') : t('pause')}
        </Button>
      </Toolbar>
      {frozenIds && (
        <Typography variant="body2" color="text.secondary">
          {t('paused')}
        </Typography>
      )}
      <VirtualGrid
        label={t('table.label')}
        columns={columns}
        rowCount={rows.length}
        getRow={getRow}
        height="min(60vh, 520px)"
        empty={t('table.empty')}
        isRowSelected={(index) => rows[index]?.assetId === selectedId}
        onRowSelect={(index) => {
          const alarm = rows[index];
          if (alarm) dispatch(selectAsset(alarm.assetId));
        }}
      />
    </Stack>
  );
};
