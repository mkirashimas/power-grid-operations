'use client';

import CancelOutlined from '@mui/icons-material/CancelOutlined';
import { Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../store';
import { findAsset } from '../../../store/assets';
import { selectAsset, selectSelectedAssetId } from '../../../store/selectionSlice';
import { fromLocalInput, toLocalInput } from '../dates';
import { INCIDENTS_NAMESPACE } from '../i18n';
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  linkedAssetIds,
  MAX_TITLE_LENGTH,
  type Incident,
  type IncidentChanges,
  type IncidentSeverity,
  type IncidentStatus,
} from '../model';

const TITLE_SAVE_DELAY_MS = 500;

interface ReportHeaderProps {
  incident: Incident;
  onSave: (changes: IncidentChanges) => void;
}

/** Title, severity, status, times and the linked assets of a report. */
export const ReportHeader = ({ incident, onSave }: ReportHeaderProps) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector(selectSelectedAssetId);
  const [title, setTitle] = useState(incident.title);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latestSave = useRef(onSave);
  useEffect(() => {
    latestSave.current = onSave;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const changeTitle = (value: string) => {
    setTitle(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => latestSave.current({ title: value.trim() || t('list.untitled') }),
      TITLE_SAVE_DELAY_MS,
    );
  };

  const assetIds = linkedAssetIds(incident);

  return (
    <Stack spacing={2}>
      <TextField
        label={t('report.titleLabel')}
        value={title}
        onChange={(event) => changeTitle(event.target.value)}
        slotProps={{ htmlInput: { maxLength: MAX_TITLE_LENGTH } }}
        fullWidth
      />
      <Box
        sx={(theme) => ({
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          [theme.breakpoints.down('md')]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          [theme.breakpoints.down('sm')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
        })}
      >
        <TextField
          select
          size="small"
          label={t('report.severity')}
          value={incident.severity}
          onChange={(event) => onSave({ severity: event.target.value as IncidentSeverity })}
        >
          {INCIDENT_SEVERITIES.map((severity) => (
            <MenuItem key={severity} value={severity}>
              {t(`severity.${severity}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('report.status')}
          value={incident.status}
          onChange={(event) => onSave({ status: event.target.value as IncidentStatus })}
        >
          {INCIDENT_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              {t(`status.${status}`)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="datetime-local"
          label={t('report.started')}
          value={toLocalInput(incident.startedAt)}
          onChange={(event) => {
            const value = fromLocalInput(event.target.value);
            if (value !== null) onSave({ startedAt: value });
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label={t('report.resolved')}
          value={incident.resolvedAt ? toLocalInput(incident.resolvedAt) : ''}
          disabled={incident.status !== 'resolved'}
          onChange={(event) => {
            const value = fromLocalInput(event.target.value);
            if (value !== null) onSave({ resolvedAt: value });
          }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
          {t('report.assets')}
        </Typography>
        {assetIds.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('report.noAssets')}
          </Typography>
        ) : (
          <Stack
            component="ul"
            direction="row"
            useFlexGap
            aria-label={t('report.assets')}
            sx={{ gap: 1, flexWrap: 'wrap', listStyle: 'none', m: 0, p: 0 }}
          >
            {assetIds.map((id) => {
              const name = findAsset(id)?.name ?? id;
              const linked = incident.assetIds.includes(id);
              return (
                <li key={id}>
                  <Chip
                    label={name}
                    variant={id === selectedId ? 'filled' : 'outlined'}
                    color={id === selectedId ? 'primary' : 'default'}
                    aria-pressed={id === selectedId}
                    onClick={() => dispatch(selectAsset(id))}
                    // Only header links can be removed; a mention is removed in the text.
                    onDelete={
                      linked
                        ? () =>
                            onSave({ assetIds: incident.assetIds.filter((other) => other !== id) })
                        : undefined
                    }
                    deleteIcon={<CancelOutlined titleAccess={t('report.unlinkAsset', { name })} />}
                  />
                </li>
              );
            })}
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
