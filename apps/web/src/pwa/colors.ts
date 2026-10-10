import { getPalette, type ThemeMode } from '@pgo/ui/theme';

/** The page background of a scheme: browser chrome (theme-color) and the install splash screen. */
export const pageBackground = (mode: ThemeMode): string => {
  const color = getPalette(mode).background?.default;
  if (!color) throw new Error(`The ${mode} palette has no background.default`);
  return color;
};
