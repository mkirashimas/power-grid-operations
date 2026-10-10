import type { TypographyVariantsOptions } from '@mui/material/styles';

export const typography: TypographyVariantsOptions = {
  // --font-roboto is set by next/font in src/app/layout.tsx.
  fontFamily: ['var(--font-roboto)', '"Helvetica Neue"', 'Arial', 'sans-serif'].join(','),
  button: { textTransform: 'none', fontWeight: 600 },
};
