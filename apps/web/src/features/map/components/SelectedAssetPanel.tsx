'use client';

import { statusOf, type Asset } from '@pgo/grid-model';
import { StatusChip } from '@pgo/ui';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { MAP_NAMESPACE } from '../i18n';

/** The selected asset with its live values, next to the map. */
export const SelectedAssetPanel = ({
  asset,
  loadingPct,
  voltagePu,
}: {
  asset: Asset | undefined;
  loadingPct: number | undefined;
  voltagePu: number | undefined;
}) => {
  const { t, i18n } = useTranslation(MAP_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const number = (digits: number) =>
    new Intl.NumberFormat(language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const live = loadingPct !== undefined && voltagePu !== undefined;
  const status = live ? statusOf(loadingPct, voltagePu) : undefined;

  const row = (label: string, value: string) => (
    <Box component="div" sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={t('panel.label')}
      data-testid="map-asset-panel"
      sx={{ p: 2 }}
    >
      {asset ? (
        <Stack spacing={1.5}>
          <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
              {asset.name}
            </Typography>
            {status && <StatusChip status={status} label={t(`legend.${status}`)} />}
          </Stack>
          <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.75 }}>
            {row(t('panel.kind'), t(`kinds.${asset.kind}`))}
            {row(t('panel.zone'), t(`zones.${asset.zone}`))}
            {row(t('panel.capacity'), t('units.mw', { value: number(0).format(asset.capacityMw) }))}
            {row(
              t('panel.loading'),
              live ? t('units.pct', { value: number(1).format(loadingPct) }) : '–',
            )}
            {row(
              t('panel.voltage'),
              live ? t('units.pu', { value: number(3).format(voltagePu) }) : '–',
            )}
          </Box>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('panel.empty')}
        </Typography>
      )}
    </Paper>
  );
};
