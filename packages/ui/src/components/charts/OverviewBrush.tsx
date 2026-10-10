'use client';

import { Box } from '@mui/material';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { prepareCanvas, useCanvasColors, withAlpha } from './canvas.ts';
import { useChart } from './ChartContext.ts';
import { clampDomain, panBy, zoomAround, type Domain } from './domain.ts';
import { downsampleMinMax } from './downsample.ts';
import { formatRange, valueScale } from './ticks.ts';
import type { ChartSeries } from './types.ts';

const HEIGHT = 56;
const HANDLE = 8;

type DragMode = 'move' | 'start' | 'end';

/**
 * The full time range in miniature, with a window showing (and setting) the visible range.
 * Drag the window to move it, its edges to resize it, or click outside it to jump there. The
 * window is a keyboard slider: arrows move, + / − resize, Home / End jump to the ends.
 */
export const OverviewBrush = ({ series }: { series: ChartSeries }) => {
  const { full, domain, setDomain, locale, timeZone, labels } = useChart();
  const { colors, scheme } = useCanvasColors();
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const drag = useRef<{ mode: DragMode; x: number; domain: Domain } | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // The full-range line, redrawn on resize or a scheme change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const frame = requestAnimationFrame(() => {
      const context = prepareCanvas(canvas, width, HEIGHT);
      if (!context) return;
      const c = colors(canvas);
      const points = downsampleMinMax(series, full[0], full[1], width);
      let min = Infinity;
      let max = -Infinity;
      points.value.forEach((v) => {
        min = Math.min(min, v);
        max = Math.max(max, v);
      });
      const y = valueScale(min, max, false).range([HEIGHT - 4, 4]);
      const x = (t: number) => ((t - full[0]) / (full[1] - full[0])) * width;
      context.beginPath();
      points.time.forEach((t, i) => context.lineTo(x(t), y(points.value[i])));
      context.strokeStyle = withAlpha(c.series(series.color), 0.8);
      context.lineWidth = 1;
      context.stroke();
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, full, width, scheme]);

  const span = full[1] - full[0];
  const left = ((domain[0] - full[0]) / span) * 100;
  const size = ((domain[1] - domain[0]) / span) * 100;
  const msPerPx = () => span / Math.max(1, trackRef.current?.getBoundingClientRect().width ?? 1);

  const startDrag = (mode: DragMode, event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, domain };
  };
  const onDrag = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const { mode, x, domain: start } = drag.current;
    const delta = (event.clientX - x) * msPerPx();
    if (mode === 'move') setDomain(panBy(start, delta, full));
    else if (mode === 'start')
      setDomain(clampDomain([Math.min(start[0] + delta, start[1]), start[1]], full));
    else setDomain(clampDomain([start[0], Math.max(start[1] + delta, start[0])], full));
  };
  const endDrag = () => {
    drag.current = null;
  };

  // Clicking the track outside the window centres the window there.
  const onTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const center = full[0] + ((event.clientX - rect.left) / rect.width) * span;
    const half = (domain[1] - domain[0]) / 2;
    setDomain(clampDomain([center - half, center + half], full));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const visible = domain[1] - domain[0];
    const keys: Record<string, () => Domain> = {
      ArrowLeft: () => panBy(domain, -visible * (event.shiftKey ? 0.5 : 0.1), full),
      ArrowRight: () => panBy(domain, visible * (event.shiftKey ? 0.5 : 0.1), full),
      PageUp: () => panBy(domain, -visible, full),
      PageDown: () => panBy(domain, visible, full),
      Home: () => clampDomain([full[0], full[0] + visible], full),
      End: () => clampDomain([full[1] - visible, full[1]], full),
      '+': () => zoomAround(domain, (domain[0] + domain[1]) / 2, 0.5, full),
      '=': () => zoomAround(domain, (domain[0] + domain[1]) / 2, 0.5, full),
      '-': () => zoomAround(domain, (domain[0] + domain[1]) / 2, 2, full),
    };
    const next = keys[event.key];
    if (next) {
      event.preventDefault();
      setDomain(next());
    }
  };

  const handleSx = (side: 'left' | 'right') => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    [side]: -HANDLE / 2,
    width: HANDLE,
    cursor: 'ew-resize',
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '30%',
      bottom: '30%',
      left: HANDLE / 2 - 1,
      width: 2,
      borderRadius: 1,
      bgcolor: 'primary.main',
    },
  });

  return (
    <Box
      ref={trackRef}
      onPointerDown={onTrackPointerDown}
      sx={{
        position: 'relative',
        height: HEIGHT,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <Box
        role="slider"
        tabIndex={0}
        aria-label={labels.overview}
        aria-valuemin={full[0]}
        aria-valuemax={full[1]}
        aria-valuenow={Math.round((domain[0] + domain[1]) / 2)}
        aria-valuetext={formatRange(domain, locale, timeZone)}
        data-testid="overview-window"
        onKeyDown={onKeyDown}
        onPointerDown={(event) => startDrag('move', event)}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${left}%`,
          width: `${Math.max(size, 0.5)}%`,
          bgcolor: (theme) => withAlpha((theme.vars || theme).palette.primary.main, 0.12),
          border: 2,
          borderColor: 'primary.main',
          borderRadius: 1,
          cursor: 'grab',
          outline: 'none',
          '&:focus-visible': {
            boxShadow: (theme) => `0 0 0 3px ${(theme.vars || theme).palette.text.primary}`,
          },
        }}
      >
        <Box
          aria-hidden
          onPointerDown={(event) => startDrag('start', event)}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          sx={handleSx('left')}
        />
        <Box
          aria-hidden
          onPointerDown={(event) => startDrag('end', event)}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          sx={handleSx('right')}
        />
      </Box>
    </Box>
  );
};
