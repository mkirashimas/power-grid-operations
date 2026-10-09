'use client';

import { StatusChip } from '@pgo/ui';
import { Checkbox, FormControlLabel, FormGroup, Stack, Typography } from '@mui/material';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../store';
import { MAP_LAYERS, type MapLayer } from '../geo';
import { MAP_NAMESPACE } from '../i18n';
import { selectLayers, setLayerVisible } from '../slice';

/** Layer toggles (with counts) and a legend that shows status by icon and text, not colour alone. */
export const MapControls = ({ counts }: { counts: Record<MapLayer, number> }) => {
  const { t } = useTranslation(MAP_NAMESPACE);
  const dispatch = useAppDispatch();
  const layers = useAppSelector(selectLayers);
  const layersId = useId();
  const legendId = useId();
  const count = new Intl.NumberFormat();

  return (
    <Stack direction="row" useFlexGap sx={{ gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
      <Stack spacing={0.5}>
        <Typography id={layersId} variant="body2" color="text.secondary">
          {t('layers.label')}
        </Typography>
        <FormGroup row aria-labelledby={layersId}>
          {/* Top layer first, as in a map legend. */}
          {[...MAP_LAYERS].reverse().map((layer) => (
            <FormControlLabel
              key={layer}
              control={
                <Checkbox
                  size="small"
                  checked={layers.includes(layer)}
                  onChange={(event) =>
                    dispatch(setLayerVisible({ layer, visible: event.target.checked }))
                  }
                />
              }
              label={t('layers.withCount', {
                layer: t(`layers.${layer}`),
                count: count.format(counts[layer]),
              })}
            />
          ))}
        </FormGroup>
      </Stack>
      <Stack spacing={0.5}>
        <Typography id={legendId} variant="body2" color="text.secondary">
          {t('legend.label')}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          role="list"
          aria-labelledby={legendId}
          sx={{ alignItems: 'center' }}
        >
          {(['normal', 'warning', 'alarm'] as const).map((status) => (
            <span role="listitem" key={status}>
              <StatusChip status={status} label={t(`legend.${status}`)} />
            </span>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
};
