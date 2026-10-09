'use client';

import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { IconButton } from '@pgo/ui';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store';
import { findAsset } from '../store/assets';
import { clearSelection, selectSelectedAssetId } from '../store/selectionSlice';
import { PATHS } from '../types';

// Views that follow the selection.
const VIEWS = [
  { key: 'telemetry', to: PATHS.TELEMETRY },
  { key: 'alarms', to: PATHS.ALARMS },
] as const;

/** The selected asset, shown on every page with links to the views that follow it. */
export const SelectionBar = () => {
  const { t } = useTranslation('common');
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const asset = findAsset(useAppSelector(selectSelectedAssetId));
  if (!asset) return null;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label={t('selection.label')}
      data-testid="selection-bar"
      sx={{ px: 2, py: 1, mb: 3 }}
    >
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          {t('selection.label')}:
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {asset.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(`selection.kinds.${asset.kind}`)} · {t(`selection.zones.${asset.zone}`)}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1 }}>
          {VIEWS.filter((view) => view.to !== pathname).map((view) => (
            <Button
              key={view.key}
              size="small"
              component={NextLink}
              href={`${view.to}?asset=${encodeURIComponent(asset.id)}`}
            >
              {t('selection.openIn', { view: t(`nav.${view.key}`) })}
            </Button>
          ))}
          <IconButton label={t('selection.clear')} onClick={() => dispatch(clearSelection())}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  );
};
