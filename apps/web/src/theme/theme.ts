import type { Localization } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';
import { components } from './components';
import { getPalette } from './palette';
import { shape } from './shape';
import { typography } from './typography';

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
