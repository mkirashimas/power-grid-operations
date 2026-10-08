'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { VirtualGrid, type GridColumn } from '../VirtualGrid/VirtualGrid.tsx';
import { VisuallyHidden } from '../VisuallyHidden/VisuallyHidden.tsx';
import { prepareCanvas, useCanvasColors, withAlpha } from './canvas.ts';
import { useChart } from './ChartContext.ts';
import { lowerBound, nearestIndex, panBy, zoomAround, type Domain } from './domain.ts';
import { formatInstant, timeTickFormat, timeTicks, valueScale } from './ticks.ts';
import type { ChartBand, ChartSeries, PaneSummaryInput, RenderStats } from './types.ts';
import { buildPaneView, type PaneView } from './view.ts';

const MARGIN = { top: 8, right: 12, bottom: 22, left: 60 };
const TABLE_ROW_LIMIT = 5000;

export interface TimeSeriesPaneProps {
  title: string;
  series: ChartSeries[];
  /** Shaded area between two curves, e.g. forecast error. */
  band?: ChartBand;
  /** Stack the series as filled areas (they must share one time axis). */
  stacked?: boolean;
  /** Keep zero on the value axis, e.g. for flows that change sign. */
  includeZero?: boolean;
  /** Canvas height in px. */
  height?: number;
  formatValue: (value: number) => string;
  /** Screen-reader summary of what the pane shows. */
  summarize: (input: PaneSummaryInput) => string;
  /** Shown next to the title, e.g. a SyntheticBadge. */
  badge?: ReactNode;
  onRenderStats?: (stats: RenderStats) => void;
}

/**
 * One canvas chart in a ChartWorkbench. Shares the workbench's time range and crosshair.
 * Pointer: drag pans, Ctrl + wheel (or pinch) zooms, double-click resets. Keyboard: arrows
 * move the crosshair, Shift + arrows pan, + / − zoom, Home / End, Esc.
 */
export const TimeSeriesPane = ({
  title,
  series,
  band,
  stacked = false,
  includeZero = false,
  height = 200,
  formatValue,
  summarize,
  badge,
  onRenderStats,
}: TimeSeriesPaneProps) => {
  const { full, domain, setDomain, crosshair, setCrosshair, locale, timeZone, labels } = useChart();
  const { colors, scheme } = useCanvasColors();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const plotWidth = Math.max(10, width - MARGIN.left - MARGIN.right);
  const view: PaneView = useMemo(
    () => buildPaneView(series, band, stacked, domain, plotWidth),
    [series, band, stacked, domain, plotWidth],
  );

  // Latest values for event listeners and callbacks that outlive a render.
  const latest = useRef({ domain, plotWidth, onRenderStats });
  useEffect(() => {
    latest.current = { domain, plotWidth, onRenderStats };
  });

  // Track the drawing width.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  const timeAt = (clientX: number) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const { domain: d, plotWidth: w } = latest.current;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left - MARGIN.left) / w));
    return d[0] + ratio * (d[1] - d[0]);
  };

  // Ctrl + wheel (and trackpad pinch, which sends ctrlKey) zooms around the pointer. Plain
  // wheel keeps scrolling the page. Needs a non-passive listener to prevent the page zoom.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.25 : 0.8;
      setDomain(zoomAround(latest.current.domain, timeAt(event.clientX), factor, full));
    };
    surface.addEventListener('wheel', onWheel, { passive: false });
    return () => surface.removeEventListener('wheel', onWheel);
  }, [full, setDomain]);

  // Draw on the next animation frame whenever anything visible changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const frame = requestAnimationFrame(() => {
      const started = performance.now();
      const context = prepareCanvas(canvas, width, height);
      if (!context) return;
      const c = colors(canvas);
      const [from, to] = domain;
      const x = (t: number) => MARGIN.left + ((t - from) / (to - from)) * plotWidth;
      const yScale = valueScale(view.yMin, view.yMax, includeZero).range([
        height - MARGIN.bottom,
        MARGIN.top,
      ]);
      const y = (value: number) => yScale(value);

      // Grid and axes.
      context.font = c.font;
      context.lineWidth = 1;
      context.strokeStyle = c.grid;
      context.fillStyle = c.text;
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      yScale.ticks(4).forEach((tick) => {
        const ty = Math.round(y(tick)) + 0.5;
        context.beginPath();
        context.moveTo(MARGIN.left, ty);
        context.lineTo(width - MARGIN.right, ty);
        context.stroke();
        context.fillText(formatValue(tick), MARGIN.left - 6, ty);
      });
      context.textAlign = 'center';
      context.textBaseline = 'top';
      const format = timeTickFormat(domain, locale, timeZone);
      timeTicks(domain, Math.max(2, Math.floor(plotWidth / 120)), timeZone).forEach((tick) => {
        context.fillText(format(tick), x(tick), height - MARGIN.bottom + 6);
      });

      context.save();
      context.beginPath();
      context.rect(MARGIN.left, MARGIN.top, plotWidth, height - MARGIN.top - MARGIN.bottom);
      context.clip();

      const fillBetween = (
        time: ArrayLike<number>,
        lower: ArrayLike<number>,
        upper: ArrayLike<number>,
        fill: string,
      ) => {
        if (time.length === 0) return;
        context.beginPath();
        for (let i = 0; i < time.length; i += 1) context.lineTo(x(time[i]), y(upper[i]));
        for (let i = time.length - 1; i >= 0; i -= 1) context.lineTo(x(time[i]), y(lower[i]));
        context.closePath();
        context.fillStyle = fill;
        context.fill();
      };
      const strokeLine = (time: ArrayLike<number>, value: ArrayLike<number>, color: string) => {
        context.beginPath();
        for (let i = 0; i < time.length; i += 1) context.lineTo(x(time[i]), y(value[i]));
        context.strokeStyle = color;
        context.stroke();
      };

      if (view.band) {
        fillBetween(
          view.band.time,
          view.band.lower,
          view.band.upper,
          withAlpha(c.series(view.band.band.color), 0.22),
        );
      }
      view.stack?.layers.forEach(({ series: s, lower, upper }) => {
        const color = c.series(s.color);
        fillBetween(view.stack!.time, lower, upper, withAlpha(color, 0.75));
        context.lineWidth = 1;
        strokeLine(view.stack!.time, upper, color);
      });
      if (includeZero && view.yMin < 0 && view.yMax > 0) {
        context.strokeStyle = c.strong;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(MARGIN.left, Math.round(y(0)) + 0.5);
        context.lineTo(width - MARGIN.right, Math.round(y(0)) + 0.5);
        context.stroke();
      }
      context.lineWidth = 1.5;
      view.lines.forEach(({ series: s, time, value }) => {
        context.setLineDash(s.dashed ? [5, 4] : []);
        strokeLine(time, value, c.series(s.color));
      });
      context.setLineDash([]);

      // Crosshair, with a dot per series at the nearest point.
      if (crosshair !== null && crosshair >= from && crosshair <= to) {
        const cx = Math.round(x(crosshair)) + 0.5;
        context.strokeStyle = c.strong;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(cx, MARGIN.top);
        context.lineTo(cx, height - MARGIN.bottom);
        context.stroke();
        view.summary.forEach(({ series: s }, k) => {
          const i = nearestIndex(s.time, crosshair);
          if (i < 0) return;
          const value = stacked
            ? view.stack!.layers[k].upper[nearestIndex(view.stack!.time, crosshair)]
            : s.value[i];
          context.beginPath();
          context.arc(x(s.time[i]), y(value), 3.5, 0, 2 * Math.PI);
          context.fillStyle = c.series(s.color);
          context.fill();
          context.strokeStyle = c.paper;
          context.stroke();
        });
      }
      context.restore();

      latest.current.onRenderStats?.({
        inputPoints: view.inputPoints,
        drawnPoints: view.drawnPoints,
        ms: view.ms + performance.now() - started,
      });
    });
    return () => cancelAnimationFrame(frame);
    // Callbacks (formatValue, colors) are read at draw time; redraws follow data, size and scheme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, crosshair, width, height, scheme, includeZero, stacked, locale, timeZone]);

  // Pointer: hover moves the crosshair, dragging pans, double-click resets.
  const drag = useRef<{ x: number; domain: Domain } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, domain };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      const start = drag.current.domain;
      const deltaMs = ((drag.current.x - event.clientX) / plotWidth) * (start[1] - start[0]);
      setDomain(panBy(start, deltaMs, full));
    }
    setCrosshair(timeAt(event.clientX));
  };
  const endDrag = () => {
    drag.current = null;
  };

  // Keyboard: the crosshair steps by 1 % of the range (at least one data point).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const span = domain[1] - domain[0];
    const time = series[0]?.time ?? [];
    const base = crosshair ?? (domain[0] + domain[1]) / 2;
    const step = (direction: number) => {
      const current = nearestIndex(time, base);
      let next = nearestIndex(time, base + direction * (span / 100));
      if (next === current) next = current + direction;
      next = Math.min(time.length - 1, Math.max(0, next));
      if (next >= 0) setCrosshair(time[next]);
    };
    const handled = () => event.preventDefault();
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        handled();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.shiftKey) setDomain(panBy(domain, direction * span * 0.1, full));
        else step(direction);
        return;
      }
      case '+':
      case '=':
        handled();
        setDomain(zoomAround(domain, base, 0.5, full));
        return;
      case '-':
      case '_':
        handled();
        setDomain(zoomAround(domain, base, 2, full));
        return;
      case 'Home':
        handled();
        if (time.length) setCrosshair(time[Math.min(time.length - 1, lowerBound(time, domain[0]))]);
        return;
      case 'End':
        handled();
        if (time.length) setCrosshair(time[Math.max(0, lowerBound(time, domain[1]) - 1)]);
        return;
      case 'Escape':
        if (crosshair !== null) {
          handled();
          setCrosshair(null);
        }
        return;
      default:
    }
  };

  const valueAt = (s: ChartSeries, t: number) => {
    const i = nearestIndex(s.time, t);
    return i < 0 ? undefined : { time: s.time[i], value: s.value[i] };
  };

  const readout =
    crosshair === null
      ? ''
      : [
          formatInstant(valueAt(series[0], crosshair)?.time ?? crosshair, locale, timeZone),
          ...series.map((s) => {
            const point = valueAt(s, crosshair);
            return point ? `${s.label}: ${formatValue(point.value)}` : '';
          }),
        ]
          .filter(Boolean)
          .join(' · ');

  const summary = summarize({
    from: domain[0],
    to: domain[1],
    series: view.summary.map((line) => ({
      label: line.series.label,
      min: line.min,
      max: line.max,
    })),
  });

  // Table rows: the drawn points of the first series (bounded), other series by nearest time.
  const tableTimes = view.stack?.time ?? view.lines[0]?.time ?? [];
  const tableCount = Math.min(tableTimes.length, TABLE_ROW_LIMIT);
  const tableColumns: GridColumn[] = [
    { id: 'time', header: labels.time, width: 200 },
    ...series.map((s) => ({ id: s.id, header: s.label, width: 140, align: 'right' as const })),
  ];

  return (
    <Box component="section" aria-labelledby={titleId}>
      <Stack
        direction="row"
        useFlexGap
        sx={{ alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}
      >
        <Typography id={titleId} variant="subtitle2" component="h3" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {badge}
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? labels.hideTable : labels.showTable}
        </Button>
      </Stack>

      <Box
        ref={surfaceRef}
        role="img"
        aria-label={summary}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => !drag.current && setCrosshair(null)}
        onDoubleClick={() => setDomain(full)}
        sx={{
          position: 'relative',
          height,
          cursor: 'crosshair',
          touchAction: 'pan-y',
          borderRadius: 1,
          outline: 'none',
          '&:focus-visible': {
            boxShadow: (theme) => `0 0 0 2px ${(theme.vars || theme).palette.primary.main}`,
          },
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </Box>
      <VisuallyHidden>
        <span id={hintId}>{labels.keyboardHint}</span>
      </VisuallyHidden>

      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        aria-live={focused ? 'polite' : 'off'}
        data-testid="chart-readout"
        sx={{ minHeight: '1.66em', mt: 0.5 }}
      >
        {readout}
      </Typography>

      {showTable && (
        <Box sx={{ mt: 1 }}>
          <VirtualGrid
            label={title}
            columns={tableColumns}
            rowCount={tableCount}
            height={280}
            getRow={(index) => {
              const t = tableTimes[index];
              return {
                kind: 'data',
                cells: [
                  formatInstant(t, locale, timeZone),
                  ...series.map((s) => {
                    const point = valueAt(s, t);
                    return point ? formatValue(point.value) : '';
                  }),
                ],
              };
            }}
          />
        </Box>
      )}
    </Box>
  );
};
