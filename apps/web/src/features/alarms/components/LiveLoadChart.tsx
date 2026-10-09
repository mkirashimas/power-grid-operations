'use client';

import type { LoadPoint } from '@pgo/grid-model';
import {
  ChartWorkbench,
  TimeSeriesPane,
  type ChartLabels,
  type ChartSeries,
  type Domain,
  type PaneSummaryInput,
} from '@pgo/ui';
import { Typography } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { ALARMS_NAMESPACE } from '../i18n';

// ERCOT operates on Central Time.
const TIME_ZONE = 'America/Chicago';
const ignoreDomainChange = () => {};

/** System load over the live history window; it follows the data, so it has no zoom. */
export const LiveLoadChart = ({ history }: { history: LoadPoint[] }) => {
  const { t, i18n } = useTranslation(ALARMS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);

  const labels: ChartLabels = useMemo(
    () => ({
      toolbar: t('chart.toolbar'),
      zoomIn: t('chart.zoomIn'),
      zoomOut: t('chart.zoomOut'),
      reset: t('chart.reset'),
      presets: { day: t('chart.day'), week: t('chart.week'), month: t('chart.month') },
      presetsLabel: t('chart.presets'),
      showTable: t('chart.showTable'),
      hideTable: t('chart.hideTable'),
      time: t('chart.time'),
      overview: t('chart.overview'),
      keyboardHint: t('chart.keyboardHint'),
    }),
    [t],
  );

  const series: ChartSeries = useMemo(
    () => ({
      id: 'load',
      label: t('chart.load'),
      color: 'series1',
      time: Float64Array.from(history, (point) => point.time),
      value: Float64Array.from(history, (point) => point.load),
    }),
    [history, t],
  );

  const formats = useMemo(
    () => ({
      mw: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: TIME_ZONE,
      }),
    }),
    [language],
  );
  const formatValue = (value: number) => t('units.mw', { value: formats.mw.format(value) });

  if (history.length < 2) {
    return <Typography color="text.secondary">{t('chart.waiting')}</Typography>;
  }
  const domain: Domain = [history[0].time, history[history.length - 1].time];

  return (
    <ChartWorkbench
      full={domain}
      domain={domain}
      onDomainChange={ignoreDomainChange}
      locale={language}
      timeZone={TIME_ZONE}
      labels={labels}
      controls={false}
    >
      <TimeSeriesPane
        title={t('chart.load')}
        series={[series]}
        height={180}
        formatValue={formatValue}
        summarize={({ from, to, series: items }: PaneSummaryInput) =>
          t('chart.summary', {
            title: t('chart.load'),
            from: formats.time.format(from),
            to: formats.time.format(to),
            series: items
              .map((s) =>
                t('chart.summaryItem', {
                  label: s.label,
                  min: formatValue(s.min),
                  max: formatValue(s.max),
                }),
              )
              .join('; '),
          })
        }
      />
    </ChartWorkbench>
  );
};
