'use client';

import { ALGORITHMS, ENGINES, type Algorithm, type Engine } from '@pgo/downsample';
import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CHARTS_NAMESPACE } from '../i18n';

interface DownsampleControlsProps {
  engine: Engine;
  algorithm: Algorithm;
  /** False when the WASM module failed to load: the WASM option is disabled. */
  wasmAvailable: boolean;
  onEngineChange: (engine: Engine) => void;
  onAlgorithmChange: (algorithm: Algorithm) => void;
}

/** Engine (JS | WASM) and algorithm (Min/max | LTTB) toggles for the 1-second pane. */
export const DownsampleControls = ({
  engine,
  algorithm,
  wasmAvailable,
  onEngineChange,
  onAlgorithmChange,
}: DownsampleControlsProps) => {
  const { t } = useTranslation(CHARTS_NAMESPACE);
  const engineId = useId();
  const algorithmId = useId();

  return (
    <Stack spacing={1}>
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center' }}>
          <Typography id={engineId} variant="body2" color="text.secondary">
            {t('downsampling.engine')}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            aria-labelledby={engineId}
            value={wasmAvailable ? engine : 'js'}
            onChange={(_, value: Engine | null) => value && onEngineChange(value)}
          >
            {ENGINES.map((option) => (
              <ToggleButton
                key={option}
                value={option}
                disabled={option === 'wasm' && !wasmAvailable}
              >
                {t(`downsampling.${option}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
        <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center' }}>
          <Typography id={algorithmId} variant="body2" color="text.secondary">
            {t('downsampling.algorithm')}
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            aria-labelledby={algorithmId}
            value={algorithm}
            onChange={(_, value: Algorithm | null) => value && onAlgorithmChange(value)}
          >
            {ALGORITHMS.map((option) => (
              <ToggleButton key={option} value={option}>
                {t(`downsampling.${option}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {wasmAvailable ? t('downsampling.note') : t('downsampling.wasmUnavailable')}
      </Typography>
    </Stack>
  );
};
