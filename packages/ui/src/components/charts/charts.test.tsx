import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../../test/utils.tsx';
import { ChartWorkbench } from './ChartWorkbench.tsx';
import type { Domain } from './domain.ts';
import { TimeSeriesPane } from './TimeSeriesPane.tsx';
import type {
  ChartLabels,
  ChartSeries,
  DownsampledLine,
  PaneDownsampler,
  RenderStats,
} from './types.ts';

const HOUR = 3_600_000;
const START = Date.UTC(2026, 9, 1);
const FULL: Domain = [START, START + 30 * 24 * HOUR];

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
  overview: 'Overview',
  keyboardHint: 'Arrows move the crosshair.',
};

const hourly = (offset: number): ChartSeries['value'] =>
  Float64Array.from({ length: 721 }, (_, i) => 50_000 + offset + 1000 * Math.sin(i / 12));
const TIME = Float64Array.from({ length: 721 }, (_, i) => START + i * HOUR);
const DEMAND: ChartSeries = {
  id: 'demand',
  label: 'Demand',
  color: 'series1',
  time: TIME,
  value: hourly(0),
};
const FORECAST: ChartSeries = {
  id: 'forecast',
  label: 'Forecast',
  color: 'series2',
  time: TIME,
  value: hourly(500),
  dashed: true,
};

const Charts = ({
  onRenderStats,
  downsample,
}: {
  onRenderStats?: (stats: RenderStats) => void;
  downsample?: PaneDownsampler;
}) => {
  const [domain, setDomain] = useState<Domain>(FULL);
  return (
    <ChartWorkbench
      full={FULL}
      domain={domain}
      onDomainChange={setDomain}
      locale="en-US"
      timeZone="UTC"
      labels={LABELS}
      overview={DEMAND}
    >
      <TimeSeriesPane
        title="Demand vs forecast"
        series={[DEMAND, FORECAST]}
        formatValue={(v) => `${Math.round(v)} MW`}
        summarize={({ series }) =>
          `Demand vs forecast. ${series.map((s) => `${s.label} ${Math.round(s.min)} to ${Math.round(s.max)} MW`).join('; ')}`
        }
        onRenderStats={onRenderStats}
        downsample={downsample}
      />
    </ChartWorkbench>
  );
};

describe('ChartWorkbench and TimeSeriesPane', () => {
  it('describes each chart to screen readers and passes axe', async () => {
    renderWithTheme(<Charts />);

    const chart = screen.getByRole('img', {
      name: /Demand vs forecast\. Demand 49000 to 51000 MW/,
    });
    expect(chart).toHaveAccessibleDescription('Arrows move the crosshair.');
    expect(screen.getByRole('region', { name: 'Demand vs forecast' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Chart controls' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('moves a crosshair with the keyboard and reads out every series', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Charts />);

    const chart = screen.getByRole('img', { name: /Demand vs forecast/ });
    chart.focus();
    await user.keyboard('{Home}');
    const readout = screen.getByTestId('chart-readout');
    expect(readout).toHaveTextContent(
      'Oct 1, 2026, 12:00:00 AM · Demand: 50000 MW · Forecast: 50500 MW',
    );
    expect(readout).toHaveAttribute('aria-live', 'polite');

    await user.keyboard('{ArrowRight}');
    expect(readout).not.toHaveTextContent('12:00:00 AM ·');
    await user.keyboard('{Escape}');
    expect(readout).toHaveTextContent('');
  });

  it('zooms with the toolbar, presets and keyboard, updating the range text', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Charts />);
    const range = screen.getByTestId('chart-range');
    const initial = range.textContent;

    await user.click(screen.getByRole('button', { name: '24 h' }));
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true');
    expect(range).toHaveTextContent('Oct 30');

    await user.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(range.textContent).toBe(initial);

    screen.getByRole('img', { name: /Demand vs forecast/ }).focus();
    await user.keyboard('+');
    expect(range.textContent).not.toBe(initial);
  });

  it('moves the visible range from the overview slider with the keyboard', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Charts />);

    await user.click(screen.getByRole('button', { name: '24 h' }));
    const slider = screen.getByRole('slider', { name: 'Overview' });
    const before = slider.getAttribute('aria-valuenow');
    slider.focus();
    await user.keyboard('{Home}');
    expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('Oct 1'));
  });

  it('shows the visible data as a table on request', async () => {
    const user = userEvent.setup();
    renderWithTheme(<Charts />);

    const toggle = screen.getByRole('button', { name: 'Show as table' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    const grid = screen.getByRole('grid', { name: 'Demand vs forecast' });
    expect(grid).toHaveAttribute('aria-colcount', '3');
    expect(screen.getByRole('columnheader', { name: 'Forecast' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide table' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('can hide the zoom toolbar and the overview, e.g. for a live view', () => {
    renderWithTheme(
      <ChartWorkbench
        full={FULL}
        domain={FULL}
        onDomainChange={() => {}}
        locale="en-US"
        timeZone="UTC"
        labels={LABELS}
        controls={false}
      >
        <TimeSeriesPane
          title="Live load"
          series={[DEMAND]}
          formatValue={String}
          summarize={() => 'Live load'}
        />
      </ChartWorkbench>,
    );
    expect(screen.getByRole('img', { name: 'Live load' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('chart-range')).toBeInTheDocument();
  });

  it('does not fire render stats without a canvas (jsdom) and fails outside a workbench', () => {
    const onRenderStats = vi.fn();
    renderWithTheme(<Charts onRenderStats={onRenderStats} />);
    expect(onRenderStats).not.toHaveBeenCalled();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      renderWithTheme(
        <TimeSeriesPane title="x" series={[DEMAND]} formatValue={String} summarize={() => 'x'} />,
      ),
    ).toThrow(/inside <ChartWorkbench>/);
  });

  it('pans with Shift + arrows', () => {
    renderWithTheme(<Charts />);
    const range = screen.getByTestId('chart-range');
    fireEvent.click(screen.getByRole('button', { name: '7 d' }));
    const before = range.textContent;
    const chart = screen.getByRole('img', { name: /Demand vs forecast/ });
    fireEvent.keyDown(chart, { key: 'ArrowLeft', shiftKey: true });
    expect(range.textContent).not.toBe(before);
  });
});

describe('TimeSeriesPane with async downsampling', () => {
  // jsdom has no ResizeObserver; report an 800 px wide pane.
  class FixedWidthObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {
      this.callback(
        [{ contentRect: { width: 800 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    disconnect() {}
    unobserve() {}
  }
  beforeEach(() => vi.stubGlobal('ResizeObserver', FixedWidthObserver));
  afterEach(() => vi.unstubAllGlobals());

  const line = (min: number, max: number): DownsampledLine => ({
    time: Float64Array.from([START, START + HOUR]),
    value: Float64Array.from([min, max]),
    inputCount: 721,
    ms: 1,
  });

  /** A downsampler whose answers the test releases by hand. */
  const deferred = () => {
    const calls: { buckets: number; resolve: (line: DownsampledLine) => void }[] = [];
    const downsample: PaneDownsampler = (_series, _from, _to, buckets) =>
      new Promise((resolve) => calls.push({ buckets, resolve }));
    return { calls, downsample };
  };

  it('requests every line at the plot width and draws the answers', async () => {
    const { calls, downsample } = deferred();
    renderWithTheme(<Charts downsample={downsample} />);

    // 800 px minus the 88 px of axis margins.
    expect(calls.map((call) => call.buckets)).toEqual([712, 712]);
    await act(async () => {
      calls[0].resolve(line(100, 200));
      calls[1].resolve(line(300, 400));
    });
    expect(
      screen.getByRole('img', {
        name: /Demand 100 to 200 MW; Forecast 300 to 400 MW/,
      }),
    ).toBeInTheDocument();
  });

  it('ignores answers that arrive after a newer request', async () => {
    const { calls, downsample } = deferred();
    renderWithTheme(<Charts downsample={downsample} />);
    fireEvent.click(screen.getByRole('button', { name: '7 d' }));
    expect(calls).toHaveLength(4);

    await act(async () => {
      calls[2].resolve(line(1000, 2000));
      calls[3].resolve(line(1000, 2000));
    });
    await act(async () => {
      calls[0].resolve(line(1, 2));
      calls[1].resolve(line(1, 2));
    });
    expect(screen.getByRole('img', { name: /Demand 1000 to 2000 MW/ })).toBeInTheDocument();
  });
});
