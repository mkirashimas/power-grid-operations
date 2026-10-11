'use client';

import type { Asset } from '@pgo/grid-model';
import { StatusChip } from '@pgo/ui';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAssetReadout } from '../hooks/useAssetReadout';
import { MAP_NAMESPACE } from '../i18n';

/** A quick look at the asset under the mouse pointer: name, status and live values. */
export const AssetTooltip = ({
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

  return (
    <Paper elevation={4} data-testid="map-asset-tooltip" sx={{ px: 1.5, py: 1, minWidth: 200 }}>
      <Stack spacing={0.5}>
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ fontWeight: 'fontWeightMedium' }}>
            {asset.name}
          </Typography>
          {readout.status && readout.statusLabel && (
            <StatusChip status={readout.status} label={readout.statusLabel} />
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {readout.kind} · {readout.zone}
        </Typography>
        {row(t('panel.loading'), readout.loading)}
        {row(t('panel.voltage'), readout.voltage)}
        {row(t('panel.capacity'), readout.rating)}
      </Stack>
    </Paper>
  );
};
