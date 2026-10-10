import { InitColorSchemeScript } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import type { ReactNode } from 'react';
import { Layout } from '../hoc/Layout';
import { Providers } from '../hoc/Providers';
import { getRequestLanguage, getServerTranslation } from '../i18n/server';
import { pageBackground } from '../pwa/colors';

const roboto = Roboto({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-roboto',
});

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation();
  return {
    title: { default: t('appName'), template: `%s · ${t('appName')}` },
    description: t('appDescription'),
    applicationName: t('appName'),
    // iOS "Add to Home Screen": full-screen app with the short name under the icon.
    appleWebApp: { capable: true, title: t('appShortName'), statusBarStyle: 'default' },
  };
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Browser chrome matches the page background of the system color scheme.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: pageBackground('light') },
    { media: '(prefers-color-scheme: dark)', color: pageBackground('dark') },
  ],
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const language = await getRequestLanguage();

  return (
    <html lang={language} className={roboto.variable} suppressHydrationWarning>
      <body>
        {/* Applies the stored or system color scheme before first paint. */}
        <InitColorSchemeScript attribute="class" />
        <AppRouterCacheProvider>
          <Providers language={language}>
            <Layout>{children}</Layout>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
};

export default RootLayout;
