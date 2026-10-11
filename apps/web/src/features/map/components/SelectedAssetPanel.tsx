'use client';

import type { Asset } from '@pgo/grid-model';
import { StatusChip } from '@pgo/ui';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAssetReadout } from '../hooks/useAssetReadout';
import { MAP_NAMESPACE } from '../i18n';

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

const AssetDetails = ({
  asset,
  loadingPct,
  voltagePu,
}: {
  asset: Asset;
  loadingPct: number | undefined;
  voltagePu: number | undefined;
}) => {
  const { t } = useTranslation(MAP_NAMESPACE);
  const readout = useAssetReadout(asset, loadingPct, voltagePu);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
          {asset.name}
        </Typography>
        {readout.status && readout.statusLabel && (
          <StatusChip status={readout.status} label={readout.statusLabel} />
        )}
      </Stack>
      <Box component="dl" sx={{ m: 0, display: 'grid', gap: 0.75 }}>
        {row(t('panel.kind'), readout.kind)}
        {row(t('panel.zone'), readout.zone)}
        {row(t('panel.capacity'), readout.rating)}
        {row(t('panel.loading'), readout.loading)}
        {row(t('panel.voltage'), readout.voltage)}
      </Box>
    </Stack>
  );
};

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
  const { t } = useTranslation(MAP_NAMESPACE);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={t('panel.label')}
      data-testid="map-asset-panel"
      sx={{ p: 2 }}
    >
      {asset ? (
        <AssetDetails asset={asset} loadingPct={loadingPct} voltagePu={voltagePu} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('panel.empty')}
        </Typography>
      )}
    </Paper>
  );
};
