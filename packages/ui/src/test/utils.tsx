import { CssBaseline } from '@mui/material';
import { enUS } from '@mui/material/locale';
import { ThemeProvider } from '@mui/material/styles';
import { render, type RenderOptions } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement, ReactNode } from 'react';
import { expect } from 'vitest';
import { createAppTheme } from '../theme/index.ts';

const theme = createAppTheme(enUS);

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    {children}
  </ThemeProvider>
);

/** Renders inside the app theme, as every component is used in the app. */
export const renderWithTheme = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: Wrapper, ...options });

/**
 * Runs axe on the rendered output. Colour contrast needs real rendering, so it is covered by
 * the theme contrast test, Storybook's a11y panel and the Playwright tests instead.
 */
export const expectNoAxeViolations = async (container: Element = document.body) => {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  expect(results.violations.map(({ id, help }) => `${id}: ${help}`)).toEqual([]);
};
