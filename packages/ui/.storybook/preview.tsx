import { CssBaseline } from '@mui/material';
import { enUS } from '@mui/material/locale';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect, type ReactNode } from 'react';
import { createAppTheme, type ThemeMode } from '../src/theme/index.ts';

const theme = createAppTheme(enUS);

/** Applies the toolbar's light/dark choice to MUI's colour scheme. */
const ColorScheme = ({ mode, children }: { mode: ThemeMode; children: ReactNode }) => {
  const { setMode } = useColorScheme();
  useEffect(() => setMode(mode), [mode, setMode]);
  return children;
};

const withTheme: Decorator = (Story, context) => (
  <ThemeProvider theme={theme} disableTransitionOnChange>
    <CssBaseline enableColorScheme />
    <ColorScheme mode={context.globals.theme as ThemeMode}>
      <Story />
    </ColorScheme>
  </ThemeProvider>
);

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
  tags: ['autodocs'],
};

export default preview;
