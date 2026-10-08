import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SyntheticBadge } from '../SyntheticBadge/SyntheticBadge.tsx';
import { ChartWorkbench } from './ChartWorkbench.tsx';
import type { Domain } from './domain.ts';
import { TimeSeriesPane } from './TimeSeriesPane.tsx';
import type { ChartLabels, ChartSeries, RenderStats } from './types.ts';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 8, 8);
const HOURS = 30 * 24;
const FULL: Domain = [START, START + HOURS * HOUR];

const LABELS: ChartLabels = {
  toolbar: 'Chart controls',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset zoom',
  presets: { day: '24 h', week: '7 d', month: '30 d' },
  presetsLabel: 'Time range',
  showTable: 'Show as table',
  hideTable: 'Hide table',
  time: 'Time',
  overview: 'Overview: drag or use the arrow keys to move the visible range',
  keyboardHint:
    'Arrow keys move the crosshair, Shift with arrows pans, plus and minus zoom, Escape clears.',
};

// Deterministic sample data in the shape of the real ERCOT series.
const hourTime = Float64Array.from({ length: HOURS + 1 }, (_, i) => START + i * HOUR);
const daily = (i: number) => Math.sin(((i % 24) - 9) * (Math.PI / 12));
const demand = Float64Array.from(
  hourTime,
  (_, i) => 52_000 + 9_000 * daily(i) + 1_500 * Math.sin(i / 50),
);
const forecast = Float64Array.from(demand, (v, i) => v + 900 * Math.sin(i / 7));
const fuels = [
  { id: 'gas', label: 'Gas', base: 22_000, swing: 7_000 },
  { id: 'wind', label: 'Wind', base: 14_000, swing: -4_000 },
  { id: 'solar', label: 'Solar', base: 6_000, swing: 9_000 },
  { id: 'nuclear', label: 'Nuclear', base: 5_000, swing: 0 },
] as const;
const COLORS = ['series1', 'series2', 'series3', 'series4'] as const;

const series = (
  id: string,
  label: string,
  value: ArrayLike<number>,
  color: ChartSeries['color'],
  dashed = false,
): ChartSeries => ({
  id,
  label,
  color,
  time: hourTime,
  value,
  dashed,
});

// About 2.6M points: one per second for 30 days.
const SECONDS = HOURS * 3600;
const secondTime = Float64Array.from({ length: SECONDS }, (_, i) => START + i * 1000);
const secondValue = Float32Array.from({ length: SECONDS }, (_, i) => {
  const hour = Math.floor(i / 3600);
  return demand[hour] + 300 * Math.sin(i / 97) + 120 * Math.sin(i / 11);
});

const mw = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatMw = (value: number) => `${mw.format(value)} MW`;
const summarize =
  (title: string) =>
  ({ series: list }: { series: { label: string; min: number; max: number }[] }) =>
    `${title}. ${list.map((s) => `${s.label} from ${formatMw(s.min)} to ${formatMw(s.max)}`).join('; ')}.`;

const Workbench = ({ withHighRes }: { withHighRes: boolean }) => {
  const [domain, setDomain] = useState<Domain>([FULL[1] - 7 * 24 * HOUR, FULL[1]]);
  const [stats, setStats] = useState<RenderStats>();
  return (
    <ChartWorkbench
      full={FULL}
      domain={domain}
      onDomainChange={setDomain}
      locale="en-US"
      timeZone="America/Chicago"
      labels={LABELS}
      overview={series('demand', 'Demand', demand, 'series1')}
    >
      <TimeSeriesPane
        title="Demand vs day-ahead forecast"
        series={[
          series('demand', 'Demand', demand, 'series1'),
          series('forecast', 'Forecast', forecast, 'series2', true),
        ]}
        band={{
          label: 'Forecast error',
          color: 'series2',
          time: hourTime,
          lower: Float64Array.from(demand, (v, i) => Math.min(v, forecast[i])),
          upper: Float64Array.from(demand, (v, i) => Math.max(v, forecast[i])),
        }}
        formatValue={formatMw}
        summarize={summarize('Demand vs day-ahead forecast')}
      />
      <TimeSeriesPane
        title="Generation by fuel"
        stacked
        series={fuels.map((fuel, k) =>
          series(
            fuel.id,
            fuel.label,
            Float64Array.from(hourTime, (_, i) => Math.max(0, fuel.base + fuel.swing * daily(i))),
            COLORS[k],
          ),
        )}
        formatValue={formatMw}
        summarize={summarize('Generation by fuel')}
      />
      <TimeSeriesPane
        title="Net interchange"
        includeZero
        height={140}
        series={[
          series(
            'interchange',
            'Interchange',
            Float64Array.from(hourTime, (_, i) => 900 * Math.sin(i / 9)),
            'series4',
          ),
        ]}
        formatValue={formatMw}
        summarize={summarize('Net interchange')}
      />
      {withHighRes && (
        <TimeSeriesPane
          title={`1-second load${stats ? ` · ${mw.format(stats.inputPoints)} → ${mw.format(stats.drawnPoints)} points in ${stats.ms.toFixed(1)} ms` : ''}`}
          badge={<SyntheticBadge label="Synthetic" />}
          series={[
            { id: 'load', label: 'Load', color: 'series3', time: secondTime, value: secondValue },
          ]}
          formatValue={formatMw}
          summarize={summarize('1-second load')}
          onRenderStats={setStats}
        />
      )}
    </ChartWorkbench>
  );
};

const meta = { title: 'Components/Charts' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Stacked panes on one time axis: hover or use the keyboard for a synced crosshair, drag to
 * pan, Ctrl + wheel to zoom, and drag the overview window. Each pane has a table view.
 */
export const Workbench3Panes: Story = {
  name: 'Workbench',
  render: () => <Workbench withHighRes={false} />,
};

/** About 2.6M points, drawn through min/max downsampling (one column per pixel). */
export const MillionsOfPoints: Story = {
  name: 'Millions of points',
  render: () => <Workbench withHighRes />,
};
