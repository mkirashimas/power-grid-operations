'use client';

import { StatusChip } from '@pgo/ui';
import {
  Alert,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import type { StudyComparison, StudyResult } from '../engine/study';
import { NETWORK_NAMESPACE } from '../i18n';
import { studyStatus } from '../status';

/** What the study changes: new overloads, islands, and the lines that moved most. */
export const StudyResults = memo(function StudyResults({
  hasEdits,
  study,
  comparison,
  onSelect,
}: {
  hasEdits: boolean;
  study: StudyResult;
  comparison: StudyComparison;
  onSelect: (assetId: string) => void;
}) {
  const { t, i18n } = useTranslation(NETWORK_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const formats = useMemo(
    () => ({
      pct: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
      delta: new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
        signDisplay: 'exceptZero',
      }),
      mw: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
    }),
    [language],
  );
  const pct = (value: number) => t('results.pct', { value: formats.pct.format(value) });

  if (!hasEdits) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('results.empty')}
      </Typography>
    );
  }

  const overloads = comparison.newOverloads.length;
  return (
    <Stack spacing={1.5} data-testid="study-results">
      <Typography variant="body2" role="status">
        {overloads ? t('results.overloads', { total: overloads }) : t('results.noOverloads')}
      </Typography>
      {study.deEnergized.length > 0 && (
        <Alert severity="warning">
          {t('results.islands', {
            total: study.deEnergized.length,
            mw: formats.mw.format(study.unservedMw),
          })}
        </Alert>
      )}
      <TableContainer
        role="region"
        aria-label={t('results.table')}
        tabIndex={0}
        sx={{ maxWidth: '100%' }}
      >
        <Table size="small">
          <caption>{t('results.table')}</caption>
          <TableHead>
            <TableRow>
              <TableCell>{t('results.line')}</TableCell>
              <TableCell align="right">{t('results.base')}</TableCell>
              <TableCell align="right">{t('results.study')}</TableCell>
              <TableCell align="right">{t('results.delta')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {comparison.changes.map((change) => {
              const status = studyStatus(change.studyPct);
              return (
                <TableRow key={change.assetId}>
                  <TableCell>
                    <Button
                      size="small"
                      sx={{ p: 0, minWidth: 0, textAlign: 'left' }}
                      onClick={() => onSelect(change.assetId)}
                    >
                      {change.name}
                    </Button>
                  </TableCell>
                  <TableCell align="right">{pct(change.basePct)}</TableCell>
                  <TableCell align="right">
                    {change.tripped ? (
                      t('results.tripped')
                    ) : status === 'normal' ? (
                      pct(change.studyPct)
                    ) : (
                      <StatusChip status={status} label={pct(change.studyPct)} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {t('results.pct', { value: formats.delta.format(change.deltaPct) })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
});
