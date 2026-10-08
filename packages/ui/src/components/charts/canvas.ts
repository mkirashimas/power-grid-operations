'use client';

import { useColorScheme, useTheme } from '@mui/material/styles';
import { useCallback } from 'react';

/**
 * Canvas cannot read CSS variables, so theme colours are resolved to concrete values from the
 * element's computed style. The result changes with the colour scheme, so callers redraw when
 * `scheme` changes.
 */
export const useCanvasColors = () => {
  const theme = useTheme();
  const { mode, systemMode } = useColorScheme();
  const scheme = mode === 'system' ? systemMode : mode;

  const resolve = useCallback((element: Element, value: string) => {
    const name = /var\((--[^,)]+)/.exec(value)?.[1];
    return (name && getComputedStyle(element).getPropertyValue(name).trim()) || value;
  }, []);

  const colors = useCallback(
    (element: Element) => {
      const palette = (theme.vars ?? theme).palette;
      return {
        text: resolve(element, palette.text.secondary),
        strong: resolve(element, palette.text.primary),
        grid: resolve(element, palette.divider),
        paper: resolve(element, palette.background.paper),
        series: (key: keyof typeof palette.chart) => resolve(element, palette.chart[key]),
        font: `12px ${getComputedStyle(element).fontFamily}`,
      };
    },
    [theme, resolve],
  );

  return { colors, scheme };
};

/** Sizes a canvas for its CSS box and the device pixel ratio; returns a scaled 2D context. */
export const prepareCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext('2d');
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  context?.clearRect(0, 0, width, height);
  return context;
};

/** Adds alpha to a #rrggbb colour. */
export const withAlpha = (color: string, alpha: number) => {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
