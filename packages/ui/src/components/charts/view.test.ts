import { describe, expect, it } from 'vitest';
import type { DownsampleResult } from './downsample.ts';
import type { ChartBand, ChartSeries } from './types.ts';
import { buildPaneView } from './view.ts';

const HOUR = 3_600_000;
const time = [0, 1, 2, 3, 4, 5].map((hour) => hour * HOUR);
const series = (id: string, value: number[]): ChartSeries => ({
  id,
  label: id,
  color: 'series1',
  time,
  value,
});

describe('buildPaneView', () => {
  it('stacks series on one time axis, clipped to the range plus the point before it', () => {
    const view = buildPaneView(
      [series('gas', [1, 1, 1, 1, 1, 1]), series('wind', [2, 2, 3, 2, 2, 2])],
      undefined,
      true,
      [2 * HOUR, 3 * HOUR],
      100,
    );
    expect(Array.from(view.stack!.time)).toEqual([1, 2, 3].map((hour) => hour * HOUR));
    expect(Array.from(view.stack!.layers[1].upper)).toEqual([3, 4, 3]);
    // Stacked panes draw areas, not lines, but still summarise every series.
    expect(view.lines).toEqual([]);
    expect(view.summary.map(({ series: s, max }) => [s.id, max])).toEqual([
      ['gas', 1],
      ['wind', 3],
    ]);
    expect([view.yMin, view.yMax]).toEqual([0, 4]);
  });

  it('fits the y-axis to the visible lines and the band', () => {
    const band: ChartBand = {
      label: 'error',
      color: 'series2',
      time,
      lower: [0, 0, -5, 0, 0, 0],
      upper: [0, 0, 20, 0, 0, 0],
    };
    const view = buildPaneView(
      [series('demand', [5, 6, 7, 8, 9, 10])],
      band,
      false,
      [1 * HOUR, 3 * HOUR],
      100,
    );
    expect(view.lines).toHaveLength(1);
    expect(view.band?.time).toHaveLength(4);
    expect([view.yMin, view.yMax]).toEqual([-5, 20]);
    expect(view.inputPoints).toBeGreaterThan(0);
  });

  it('uses lines prepared elsewhere and leaves out series not ready yet', () => {
    const prepared: Record<string, DownsampleResult> = {
      load: { time: Float64Array.of(0, HOUR), value: Float64Array.of(10, 30), inputCount: 3600 },
    };
    const view = buildPaneView(
      [series('load', [0, 0, 0, 0, 0, 0]), series('pending', [1, 1, 1, 1, 1, 1])],
      undefined,
      false,
      [0, HOUR],
      100,
      prepared,
    );
    expect(view.lines.map((line) => line.series.id)).toEqual(['load']);
    expect(view).toMatchObject({ inputPoints: 3600, drawnPoints: 2, yMin: 10, yMax: 30 });
  });

  it('falls back to a 0–1 axis when nothing is visible', () => {
    const view = buildPaneView([], undefined, false, [0, HOUR], 100);
    expect([view.yMin, view.yMax]).toEqual([0, 1]);
  });
});
