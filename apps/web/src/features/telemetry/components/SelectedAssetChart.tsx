'use client';

import type { Asset, TelemetryColumns } from '@pgo/grid-model';
import {
  ChartWorkbench,
  Panel,
  TimeSeriesPane,
  type ChartLabels,
  type ChartSeries,
  type Domain,
  type PaneSummaryInput,
} from '@pgo/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { assetSeries } from '../engine/assetSeries';
import { TELEMETRY_NAMESPACE } from '../i18n';

// ERCOT operates on Central Time.
const TIME_ZONE = 'America/Chicago';

/** MW and loading % of the selected asset over the telemetry window. */
export const SelectedAssetChart = ({
  asset,
  columns,
}: {
  asset: Asset;
  columns: TelemetryColumns;
}) => {
  const { t, i18n } = useTranslation(TELEMETRY_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);

  const data = useMemo(() => assetSeries(columns, asset.index), [columns, asset.index]);
  const full: Domain = [data.time[0] ?? 0, data.time[data.time.length - 1] ?? 1];
  // A new asset shows its whole window again.
  const [zoom, setZoom] = useState<{ assetId: string; domain: Domain } | null>(null);
  const domain = zoom?.assetId === asset.id ? zoom.domain : full;

  const series = useMemo(() => {
    const make = (id: 'mw' | 'loading', color: ChartSeries['color'], value: Float32Array) => ({
      id,
      label: t(`assetChart.${id}`),
      color,
      time: data.time,
      value,
    });
    return {
      mw: make('mw', 'series1', data.mw),
      loading: make('loading', 'series3', data.loadingPct),
    };
  }, [data, t]);

  const labels: ChartLabels = useMemo(
    () => ({
      toolbar: t('assetChart.toolbar'),
      zoomIn: t('assetChart.zoomIn'),
      zoomOut: t('assetChart.zoomOut'),
      reset: t('assetChart.reset'),
      presets: {
        day: t('assetChart.day'),
        week: t('assetChart.week'),
        month: t('assetChart.month'),
      },
      presetsLabel: t('assetChart.presets'),
      showTable: t('assetChart.showTable'),
      hideTable: t('assetChart.hideTable'),
      time: t('assetChart.time'),
      overview: t('assetChart.overview'),
      keyboardHint: t('assetChart.keyboardHint'),
    }),
    [t],
  );

  const formats = useMemo(
    () => ({
      number: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
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
  const mw = (value: number) => t('assetChart.unitMw', { value: formats.number.format(value) });
  const pct = (value: number) => t('assetChart.unitPct', { value: formats.number.format(value) });
  const summarize =
    (title: string, format: (value: number) => string) =>
    ({ from, to, series: items }: PaneSummaryInput) =>
      t('assetChart.summary', {
        title,
        from: formats.date.format(from),
        to: formats.date.format(to),
        series: items
          .map((s) =>
            t('assetChart.summaryItem', { label: s.label, min: format(s.min), max: format(s.max) }),
          )
          .join('; '),
      });

  const title = t('assetChart.title', { name: asset.name });
  return (
    <Panel title={title}>
      <ChartWorkbench
        full={full}
        domain={domain}
        onDomainChange={(next) => setZoom({ assetId: asset.id, domain: next })}
        locale={language}
        timeZone={TIME_ZONE}
        labels={labels}
        overview={series.mw}
      >
        <TimeSeriesPane
          title={t('assetChart.mwPane')}
          series={[series.mw]}
          height={160}
          formatValue={mw}
          summarize={summarize(t('assetChart.mwPane'), mw)}
        />
        <TimeSeriesPane
          title={t('assetChart.loadingPane')}
          series={[series.loading]}
          height={160}
          includeZero
          formatValue={pct}
          summarize={summarize(t('assetChart.loadingPane'), pct)}
        />
      </ChartWorkbench>
    </Panel>
  );
};
