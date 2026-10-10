'use client';

import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { LiveAnnouncer } from '@pgo/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Provider } from 'react-redux';
import { getI18n } from '../i18n';
import { toLanguage } from '../i18n/language';
import { makeStore } from '../store';
import { createAppTheme, MUI_LOCALES } from '../theme';
import type { Language } from '../types';

/** Rebuilds the MUI theme with the matching MUI locale whenever the language changes. */
const ThemedApp = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const language = toLanguage(i18n.resolvedLanguage);
  const theme = useMemo(() => createAppTheme(MUI_LOCALES[language]), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    // disableTransitionOnChange: switch schemes instantly, without animating every colour.
    <ThemeProvider theme={theme} disableTransitionOnChange>
      <CssBaseline enableColorScheme />
      {/* App-wide live regions for screen-reader announcements (useAnnounce). */}
      <LiveAnnouncer>{children}</LiveAnnouncer>
    </ThemeProvider>
  );
};

interface ProvidersProps {
  /** Language resolved on the server from the cookie or Accept-Language. */
  language: Language;
  children: ReactNode;
}

export const Providers = ({ language, children }: ProvidersProps) => {
  const [store] = useState(makeStore);
  const [i18n] = useState(() => getI18n(language));

  return (
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <ThemedApp>{children}</ThemedApp>
      </I18nextProvider>
    </Provider>
  );
};
