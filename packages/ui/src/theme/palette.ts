import type { PaletteOptions } from '@mui/material/styles';
import type { ThemeMode } from './types.ts';

// Status colours are text-safe (WCAG AA) on both backgrounds. MUI's feedback colours
// (error, warning, success, info) reuse them, because MUI's defaults fail AA as text on these
// surfaces (e.g. #d32f2f is 4.05:1 on the light page).
const LIGHT_STATUS = {
  normal: '#1b6e3a',
  warning: '#8a5300',
  alarm: '#b3261e',
  offline: '#5e646a',
};
const DARK_STATUS = { normal: '#6fcf97', warning: '#f2c14e', alarm: '#ff8a80', offline: '#a2a8ae' };

// Neutral slate surfaces with a monochrome primary.
const palettes: Record<ThemeMode, PaletteOptions> = {
  light: {
    mode: 'light',
    primary: { main: '#2f3a44', contrastText: '#ffffff' },
    secondary: { main: '#4a5157' },
    error: { main: LIGHT_STATUS.alarm, contrastText: '#ffffff' },
    warning: { main: LIGHT_STATUS.warning, contrastText: '#ffffff' },
    success: { main: LIGHT_STATUS.normal, contrastText: '#ffffff' },
    info: { main: '#1f5f99', contrastText: '#ffffff' },
    background: { default: '#e6e8e9', paper: '#f6f7f7' },
    surface: { sidebar: '#dadddf' },
    status: LIGHT_STATUS,
    chart: {
      series1: '#1f5f99',
      series2: '#b35c00',
      series3: '#1b6e3a',
      series4: '#7a3b9a',
      series5: '#8a6d00',
      series6: '#a1314f',
    },
    text: { primary: '#1e2124', secondary: '#5e646a' },
    divider: '#d3d7da',
    action: { hover: '#dde0e2', selected: '#f6f7f7' },
  },
  dark: {
    mode: 'dark',
    primary: { main: '#e3e5e7', contrastText: '#232527' },
    secondary: { main: '#a9bccf' },
    // Light colours on dark surfaces, so their contrast text is dark.
    error: { main: DARK_STATUS.alarm, contrastText: '#232527' },
    warning: { main: DARK_STATUS.warning, contrastText: '#232527' },
    success: { main: DARK_STATUS.normal, contrastText: '#232527' },
    info: { main: '#8ab4f8', contrastText: '#232527' },
    background: { default: '#232527', paper: '#26292b' },
    surface: { sidebar: '#232527' },
    status: DARK_STATUS,
    chart: {
      series1: '#8ab4f8',
      series2: '#f0a35e',
      series3: '#6fcf97',
      series4: '#c99ee8',
      series5: '#e6c85a',
      series6: '#f48fb1',
    },
    text: { primary: '#e3e5e7', secondary: '#a2a8ae' },
    divider: '#2f3234',
    action: { hover: '#32373c', selected: '#353a3f' },
  },
};

export const getPalette = (mode: ThemeMode): PaletteOptions => palettes[mode];
