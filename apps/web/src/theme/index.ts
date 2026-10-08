import { enUS, esES, frFR, itIT, roRO, type Localization } from '@mui/material/locale';
import type { Language } from '../types';

// The theme itself lives in the design system (packages/ui); the app adds the MUI locales.
export { createAppTheme } from '@pgo/ui/theme';

export const MUI_LOCALES: Record<Language, Localization> = {
  en: enUS,
  es: esES,
  fr: frFR,
  it: itIT,
  ro: roRO,
};
