'use client';

import {
  findSeries,
  generateHighResLoad,
  type EiaSnapshot,
  type HighResSeries,
} from '@pgo/grid-model';
import { Stack, Typography } from '@mui/material';
import {
  ChartWorkbench,
  clampDomain,
  lastSpan,
  Panel,
  SyntheticBadge,
  TimeSeriesPane,
  type ChartLabels,
  type ChartSeries,
  type Domain,
  type PaneSummaryInput,
  type RenderStats,
} from '@pgo/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { useAppDispatch, useAppSelector } from '../../../store';
import { prepareChartData } from '../data';
import { useDomainUrlSync } from '../hooks/useDomainUrlSync';
import { CHARTS_NAMESPACE } from '../i18n';
import { selectDomain, setDomain } from '../slice';

const DAY = 24 * 3_600_000;
// ERCOT operates on Central Time.
const TIME_ZONE = 'America/Chicago';
const FUEL_COLORS = ['series1', 'series2', 'series3', 'series4', 'series5', 'series6'] as const;

export const ChartsView = ({ snapshot }: { snapshot: EiaSnapshot }) => {
  const { t, i18n } = useTranslation(CHARTS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const dispatch = useAppDispatch();
  useDomainUrlSync();

  const data = useMemo(() => prepareChartData(snapshot), [snapshot]);
  const stored = useAppSelector(selectDomain);
  const domain: Domain = stored ? clampDomain(stored, data.full) : lastSpan(data.full, 7 * DAY);
  const onDomainChange = useCallback(
    (next: Domain) => dispatch(setDomain([next[0], next[1]])),
    [dispatch],
  );

  // The 1-second series (about 2.6M points) is generated after the first paint.
  const demandPoints = findSeries(snapshot, 'demand')?.points;
  const demandKey = `${demandPoints?.length}:${demandPoints?.at(-1)?.period}`;
  const [highRes, setHighRes] = useState<{ series: HighResSeries; ms: number } | null>(null);
  const [stats, setStats] = useState<RenderStats>();
  useEffect(() => {
    if (!demandPoints) return;
    const timer = setTimeout(() => {
      const started = performance.now();
      const series = generateHighResLoad(demandPoints);
      setHighRes({ series, ms: performance.now() - started });
    });
    return () => clearTimeout(timer);
    // Regenerate only when the demand data itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandKey]);

  const formats = useMemo(
    () => ({
      mw: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
      count: new Intl.NumberFormat(language),
      ms: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
      date: new Intl.DateTimeFormat(language, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TIME_ZONE,
      }),
    }),
    [language],
  );
  const formatValue = (value: number) => t('units.mw', { value: formats.mw.format(value) });
  const summarize =
    (title: string) =>
    ({ from, to, series }: PaneSummaryInput) =>
      t('summary', {
        title,
        from: formats.date.format(from),
        to: formats.date.format(to),
        series: series
          .map((s) =>
            t('summaryItem', {
              label: s.label,
              min: formatValue(s.min),
              max: formatValue(s.max),
            }),
          )
          .join('; '),
      });

  const labels: ChartLabels = useMemo(
    () => ({
      toolbar: t('labels.toolbar'),
      zoomIn: t('labels.zoomIn'),
      zoomOut: t('labels.zoomOut'),
      reset: t('labels.reset'),
      presets: { day: t('labels.day'), week: t('labels.week'), month: t('labels.month') },
      presetsLabel: t('labels.presets'),
      showTable: t('labels.showTable'),
      hideTable: t('labels.hideTable'),
      time: t('labels.time'),
      overview: t('labels.overview'),
      keyboardHint: t('labels.keyboardHint'),
    }),
    [t],
  );

  const series = useMemo(() => {
    const make = (
      id: string,
      color: ChartSeries['color'],
      { time, value }: { time: ArrayLike<number>; value: ArrayLike<number> },
      dashed = false,
    ): ChartSeries => ({ id, label: t(`series.${id}`), color, time, value, dashed });
    return {
      demand: make('demand', 'series1', data.demand),
      forecast: make('forecast', 'series2', data.forecast, true),
      interchange: make('interchange', 'series4', data.interchange),
      fuels: data.fuels.map((fuel, i) => ({
        id: fuel.key,
        label: t(`fuels.${fuel.key}`),
        color: FUEL_COLORS[i],
        time: fuel.time,
        value: fuel.value,
      })),
      load: highRes ? make('load', 'series3', highRes.series) : undefined,
    };
  }, [data, highRes, t]);

  const band = useMemo(
    () => ({ label: t('series.error'), color: 'series2' as const, ...data.error }),
    [data, t],
  );

  return (
    <Panel title={t('workbench')}>
      <ChartWorkbench
        full={data.full}
        domain={domain}
        onDomainChange={onDomainChange}
        locale={language}
        timeZone={TIME_ZONE}
        labels={labels}
        overview={series.demand}
      >
        <TimeSeriesPane
          title={t('panes.demand')}
          series={[series.demand, series.forecast]}
          band={band}
          formatValue={formatValue}
          summarize={summarize(t('panes.demand'))}
        />
        <TimeSeriesPane
          title={t('panes.fuel')}
          series={series.fuels}
          stacked
          formatValue={formatValue}
          summarize={summarize(t('panes.fuel'))}
        />
        <TimeSeriesPane
          title={t('panes.interchange')}
          series={[series.interchange]}
          includeZero
          height={150}
          formatValue={formatValue}
          summarize={summarize(t('panes.interchange'))}
        />
        {series.load ? (
          <TimeSeriesPane
            title={t('panes.highRes')}
            series={[series.load]}
            formatValue={formatValue}
            summarize={summarize(t('panes.highRes'))}
            onRenderStats={setStats}
            badge={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <SyntheticBadge label={t('synthetic')} />
                {stats && (
                  <Typography variant="caption" color="text.secondary" data-testid="highres-stats">
                    {t('highResStats', {
                      input: formats.count.format(stats.inputPoints),
                      drawn: formats.count.format(stats.drawnPoints),
                      ms: formats.ms.format(stats.ms),
                    })}
                  </Typography>
                )}
              </Stack>
            }
          />
        ) : (
          <Typography color="text.secondary">{t('loadingHighRes')}</Typography>
        )}
      </ChartWorkbench>
    </Panel>
  );
};
