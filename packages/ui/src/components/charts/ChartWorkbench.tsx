'use client';

import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import ZoomInOutlined from '@mui/icons-material/ZoomInOutlined';
import ZoomOutOutlined from '@mui/icons-material/ZoomOutOutlined';
import { Box, Button, ButtonGroup, Stack, Typography } from '@mui/material';
import { useMemo, useState, type ReactNode } from 'react';
import { IconButton } from '../IconButton/IconButton.tsx';
import { Toolbar } from '../Toolbar/Toolbar.tsx';
import { ChartContext } from './ChartContext.ts';
import { lastSpan, zoomAround, type Domain } from './domain.ts';
import { OverviewBrush } from './OverviewBrush.tsx';
import { formatRange } from './ticks.ts';
import type { ChartContextValue, ChartLabels, ChartSeries } from './types.ts';

const HOUR = 3_600_000;
const PRESETS = [
  { key: 'day', span: 24 * HOUR },
  { key: 'week', span: 7 * 24 * HOUR },
  { key: 'month', span: 30 * 24 * HOUR },
] as const;

export interface ChartWorkbenchProps {
  /** The whole data range. */
  full: Domain;
  /** The visible range (controlled). */
  domain: Domain;
  onDomainChange: (domain: Domain) => void;
  /** BCP 47 locale for numbers and dates, e.g. 'en'. */
  locale: string;
  /** IANA zone for time axes, e.g. 'America/Chicago'. */
  timeZone: string;
  labels: ChartLabels;
  /** Drawn in the overview brush under the panes; no brush without it. */
  overview?: ChartSeries;
  /** Shows the zoom toolbar (default). Off for views that follow live data. */
  controls?: boolean;
  /** TimeSeriesPane elements. */
  children: ReactNode;
}

/**
 * Stacked time-series panes on one shared, zoomable time axis, with a synced crosshair, a
 * toolbar (zoom, reset, 24 h / 7 d / 30 d) and an overview brush.
 */
export const ChartWorkbench = ({
  full,
  domain,
  onDomainChange,
  locale,
  timeZone,
  labels,
  overview,
  controls = true,
  children,
}: ChartWorkbenchProps) => {
  const [crosshair, setCrosshair] = useState<number | null>(null);

  const context = useMemo<ChartContextValue>(
    () => ({
      full,
      domain,
      setDomain: onDomainChange,
      crosshair,
      setCrosshair,
      locale,
      timeZone,
      labels,
    }),
    [full, domain, onDomainChange, crosshair, locale, timeZone, labels],
  );

  const center = crosshair ?? (domain[0] + domain[1]) / 2;
  const isPreset = (span: number) => {
    const preset = lastSpan(full, span);
    return preset[0] === domain[0] && preset[1] === domain[1];
  };

  return (
    <ChartContext.Provider value={context}>
      <Stack spacing={2}>
        <Stack
          direction="row"
          useFlexGap
          sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
        >
          {controls && (
            <Toolbar label={labels.toolbar}>
              <IconButton
                label={labels.zoomIn}
                onClick={() => onDomainChange(zoomAround(domain, center, 0.5, full))}
              >
                <ZoomInOutlined />
              </IconButton>
              <IconButton
                label={labels.zoomOut}
                onClick={() => onDomainChange(zoomAround(domain, center, 2, full))}
              >
                <ZoomOutOutlined />
              </IconButton>
              <IconButton label={labels.reset} onClick={() => onDomainChange(full)}>
                <RestartAltOutlined />
              </IconButton>
              <ButtonGroup size="small" aria-label={labels.presetsLabel}>
                {PRESETS.map(({ key, span }) => (
                  <Button
                    key={key}
                    aria-pressed={isPreset(span)}
                    variant={isPreset(span) ? 'contained' : 'outlined'}
                    onClick={() => onDomainChange(lastSpan(full, span))}
                  >
                    {labels.presets[key]}
                  </Button>
                ))}
              </ButtonGroup>
            </Toolbar>
          )}
          <Typography variant="body2" color="text.secondary" data-testid="chart-range">
            {formatRange(domain, locale, timeZone)}
          </Typography>
        </Stack>

        <Stack spacing={3}>{children}</Stack>

        {overview && (
          <Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
              {labels.overview}
            </Typography>
            <OverviewBrush series={overview} />
          </Box>
        )}
      </Stack>
    </ChartContext.Provider>
  );
};
