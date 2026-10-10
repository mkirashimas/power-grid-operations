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

  /** Categorical chart colours: at least 3:1 against background.paper in both schemes. */
  interface ChartPalette {
    series1: string;
    series2: string;
    series3: string;
    series4: string;
    series5: string;
    series6: string;
  }

  interface Palette {
    surface: SurfacePalette;
    status: StatusPalette;
    chart: ChartPalette;
  }

  interface PaletteOptions {
    surface?: Partial<SurfacePalette>;
    status?: Partial<StatusPalette>;
    chart?: Partial<ChartPalette>;
  }
}

export {};
