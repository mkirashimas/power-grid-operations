'use client';

import AddOutlined from '@mui/icons-material/AddOutlined';
import ReportOutlined from '@mui/icons-material/ReportOutlined';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ConfirmDialog, EmptyState, FilterField, StatusChip, useAnnounce } from '@pgo/ui';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../store';
import { findAsset } from '../../../store/assets';
import { PATHS } from '../../../types';
import {
  useCreateIncidentMutation,
  useListIncidentsQuery,
  useResetIncidentsMutation,
} from '../api';
import { formatDateTime } from '../dates';
import { useIncidentListUrlSync } from '../hooks/useIncidentListUrlSync';
import { INCIDENTS_NAMESPACE } from '../i18n';
import {
  filterIncidents,
  INCIDENT_STATUSES,
  linkedAssetIds,
  type Incident,
  type StatusFilter,
} from '../model';
import { selectIncidentFilters, setQuery, setStatusFilter } from '../slice';

const SHOWN_ASSETS = 2;

const AssetNames = ({ incident }: { incident: Incident }) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const ids = linkedAssetIds(incident);
  const names = ids.slice(0, SHOWN_ASSETS).map((id) => findAsset(id)?.name ?? id);
  return (
    <>
      {names.join(', ')}
      {ids.length > SHOWN_ASSETS &&
        ` ${t('list.moreAssets', { count: ids.length - SHOWN_ASSETS })}`}
    </>
  );
};

/** All reports in this browser, with filters mirrored in the URL. */
export const IncidentList = () => {
  const { t, i18n } = useTranslation(INCIDENTS_NAMESPACE);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const announce = useAnnounce();
  useIncidentListUrlSync();
  const { status, query } = useAppSelector(selectIncidentFilters);
  const { data: incidents, isLoading, isError } = useListIncidentsQuery();
  const [createIncident, { isLoading: creating }] = useCreateIncidentMutation();
  const [resetIncidents] = useResetIncidentsMutation();
  const [confirmReset, setConfirmReset] = useState(false);

  const visible = useMemo(
    () => filterIncidents(incidents ?? [], status, query),
    [incidents, status, query],
  );
  const filtered = status !== 'all' || query.trim() !== '';

  const create = async () => {
    const incident = await createIncident({ title: t('list.untitled') }).unwrap();
    router.push(PATHS.incident(incident.id));
  };

  const reset = async () => {
    setConfirmReset(false);
    await resetIncidents().unwrap();
    announce(t('list.resetDone'));
  };

  const clearFilters = () => {
    dispatch(setStatusFilter('all'));
    dispatch(setQuery(''));
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterField
          label={t('list.search')}
          placeholder={t('list.searchPlaceholder')}
          clearLabel={t('list.clearSearch')}
          value={query}
          onChange={(value) => dispatch(setQuery(value))}
        />
        <TextField
          select
          size="small"
          label={t('list.status')}
          value={status}
          onChange={(event) => dispatch(setStatusFilter(event.target.value as StatusFilter))}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">{t('list.allStatuses')}</MenuItem>
          {INCIDENT_STATUSES.map((option) => (
            <MenuItem key={option} value={option}>
              {t(`status.${option}`)}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<RestartAltOutlined />}
          onClick={() => setConfirmReset(true)}
        >
          {t('list.reset')}
        </Button>
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          disabled={creating}
          onClick={() => void create()}
        >
          {creating ? t('list.creating') : t('list.new')}
        </Button>
      </Stack>

      {isError && <Alert severity="error">{t('list.error')}</Alert>}

      {isLoading ? (
        <Stack spacing={1} sx={{ alignItems: 'center', py: 6 }}>
          <CircularProgress size={28} aria-hidden />
          <Typography color="text.secondary">{t('list.loading')}</Typography>
        </Stack>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ReportOutlined />}
          title={filtered ? t('list.empty') : t('list.emptyAll')}
          headingLevel={2}
          action={
            filtered ? (
              <Button variant="outlined" onClick={clearFilters}>
                {t('list.clearFilters')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" role="status">
            {t('list.count', { count: visible.length })}
          </Typography>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table aria-label={t('list.label')} size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('list.columns.title')}</TableCell>
                  <TableCell>{t('list.columns.severity')}</TableCell>
                  <TableCell>{t('list.columns.status')}</TableCell>
                  <TableCell>{t('list.columns.assets')}</TableCell>
                  <TableCell>{t('list.columns.updated')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((incident) => (
                  <TableRow key={incident.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Link
                          component={NextLink}
                          href={PATHS.incident(incident.id)}
                          sx={{ fontWeight: 600 }}
                        >
                          {incident.title}
                        </Link>
                        {incident.sample && (
                          <Chip label={t('sample')} size="small" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        status={incident.severity}
                        label={t(`severity.${incident.severity}`)}
                      />
                    </TableCell>
                    <TableCell>{t(`status.${incident.status}`)}</TableCell>
                    <TableCell>
                      <AssetNames incident={incident} />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(incident.updatedAt, i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <ConfirmDialog
        open={confirmReset}
        title={t('list.resetTitle')}
        body={t('list.resetBody')}
        confirmLabel={t('list.resetConfirm')}
        cancelLabel={t('list.cancel')}
        destructive
        onConfirm={() => void reset()}
        onCancel={() => setConfirmReset(false)}
      />
    </Stack>
  );
};
