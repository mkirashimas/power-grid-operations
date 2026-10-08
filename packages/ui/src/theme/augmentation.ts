// TypeScript module augmentation for the app's custom theme keys. Imported by theme.ts, so
// every package that uses the theme sees these types.
import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface SurfacePalette {
    /** Background of the left navigation sidebar. */
    sidebar: string;
  }

  /** Operational status colours. Text-safe (WCAG AA) on background.paper in both schemes. */
  interface StatusPalette {
    normal: string;
    warning: string;
    alarm: string;
    offline: string;
  }

  interface Palette {
    surface: SurfacePalette;
    status: StatusPalette;
  }

  interface PaletteOptions {
    surface?: Partial<SurfacePalette>;
    status?: Partial<StatusPalette>;
  }
}

export {};
