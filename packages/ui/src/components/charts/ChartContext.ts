'use client';

import { createContext, useContext } from 'react';
import type { ChartContextValue } from './types.ts';

export const ChartContext = createContext<ChartContextValue | null>(null);

/** Shared range, crosshair and labels of the surrounding ChartWorkbench. */
export const useChart = (): ChartContextValue => {
  const value = useContext(ChartContext);
  if (!value) {
    throw new Error('Chart panes must be rendered inside <ChartWorkbench>');
  }
  return value;
};
