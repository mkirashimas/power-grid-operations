import type { Components, Theme } from '@mui/material/styles';

// Overrides use theme.vars (CSS variables) so a single stylesheet serves both color schemes.
export const components: Components<Omit<Theme, 'components'>> = {
  MuiAppBar: {
    defaultProps: { elevation: 0, color: 'inherit', position: 'fixed' },
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: (theme.vars || theme).palette.background.default,
        color: (theme.vars || theme).palette.text.primary,
        borderBottom: `1px solid ${(theme.vars || theme).palette.divider}`,
      }),
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
  },
  MuiTypography: {
    styleOverrides: {
      // Page titles (h4) step down to the h5 size on phones.
      h4: ({ theme }) => ({
        [theme.breakpoints.down('sm')]: { fontSize: theme.typography.h5.fontSize },
      }),
    },
  },
  MuiPaper: {
    // No dark-mode elevation overlay: paper keeps the exact palette color.
    styleOverrides: { root: { backgroundImage: 'none' } },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: ({ theme }) => ({
        backgroundColor: (theme.vars || theme).palette.surface.sidebar,
        borderRight: `1px solid ${(theme.vars || theme).palette.divider}`,
      }),
    },
  },
  MuiListItemButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: theme.shape.borderRadius,
        '&.Mui-selected, &.Mui-selected:hover': {
          backgroundColor: (theme.vars || theme).palette.action.selected,
        },
      }),
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      // MUI's default (action.active, 54% black) is 4.34:1 on the light page: below AA.
      root: ({ theme }) => ({
        color: (theme.vars || theme).palette.text.secondary,
        '&.Mui-selected, &.Mui-selected:hover': {
          color: (theme.vars || theme).palette.text.primary,
        },
      }),
    },
  },
};
