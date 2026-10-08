import type { Localization } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';
import './augmentation.ts';
import { components } from './components.ts';
import { getPalette } from './palette.ts';
import { shape } from './shape.ts';
import { typography } from './typography.ts';

/**
 * Both color schemes live in one theme as CSS variables, so the server renders the same markup
 * for every visitor and the light/dark switch never flashes. Rebuilt only when the locale changes.
 */
export const createAppTheme = (locale: Localization) =>
  createTheme(
    {
      cssVariables: { colorSchemeSelector: 'class' },
      colorSchemes: {
        light: { palette: getPalette('light') },
        dark: { palette: getPalette('dark') },
      },
      typography,
      shape,
      components,
    },
    locale,
  );
