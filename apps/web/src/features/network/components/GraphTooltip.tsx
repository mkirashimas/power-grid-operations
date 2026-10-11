'use client';

import type { Asset, TelemetryStatus } from '@pgo/grid-model';
import { StatusChip } from '@pgo/ui';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { NETWORK_NAMESPACE } from '../i18n';

const NO_VALUE = '–';

export interface GraphTooltipProps {
  asset: Asset;
  status: TelemetryStatus | undefined;
  /** Live loading, or the study's loading for a line in what-if mode. */
  loadingPct: number | undefined;
  /** Live voltage; undefined in what-if mode, where the DC study has no voltages. */
  voltagePu: number | undefined;
  /** What-if mode: the loading comes from the study. */
  study: boolean;
  tripped: boolean;
  deEnergized: boolean;
}

/** A quick look at the substation or line under the mouse pointer. */
export const GraphTooltip = ({
  asset,
  status,
  loadingPct,
  voltagePu,
  study,
  tripped,
  deEnergized,
}: GraphTooltipProps) => {
  const { t, i18n } = useTranslation(NETWORK_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const number = (digits: number) =>
    new Intl.NumberFormat(language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

  const row = (label: string, value: string) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );

  const loading = tripped
    ? t('results.tripped')
    : loadingPct === undefined
      ? NO_VALUE
      : t('units.pct', { value: number(1).format(loadingPct) });

  return (
    <Paper elevation={4} data-testid="graph-asset-tooltip" sx={{ px: 1.5, py: 1, minWidth: 200 }}>
      <Stack spacing={0.5}>
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'fontWeightMedium' }}>
            {asset.name}
          </Typography>
          {status && <StatusChip status={status} label={t(`statuses.${status}`)} />}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t(`kinds.${asset.kind}`)} · {t(`zones.${asset.zone}`)}
        </Typography>
        {deEnergized && (
          <Typography variant="caption" color="error">
            {t('hover.deEnergized')}
          </Typography>
        )}
        {row(t(study ? 'hover.studyLoading' : 'hover.loading'), loading)}
        {!study &&
          row(
            t('hover.voltage'),
            voltagePu === undefined
              ? NO_VALUE
              : t('units.pu', { value: number(3).format(voltagePu) }),
          )}
        {row(t('hover.rating'), t('units.mw', { value: number(0).format(asset.capacityMw) }))}
      </Stack>
    </Paper>
  );
};
