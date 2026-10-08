import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../../test/utils.tsx';
import { ChartWorkbench } from './ChartWorkbench.tsx';
import type { Domain } from './domain.ts';
import { TimeSeriesPane } from './TimeSeriesPane.tsx';
import type { ChartLabels, ChartSeries, RenderStats } from './types.ts';

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

const Charts = ({ onRenderStats }: { onRenderStats?: (stats: RenderStats) => void }) => {
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
