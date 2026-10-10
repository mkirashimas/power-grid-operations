import { Button, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { getServerTranslation } from '../../i18n/server';
import { PATHS } from '../../types';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation();
  return { title: t('offline.title') };
};

// Precached by the service worker and shown for pages that were never opened on this device.
const OfflinePage = async () => {
  const t = await getServerTranslation();

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        {t('offline.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('offline.body')}
      </Typography>
      <Button variant="contained" href={PATHS.HOME}>
        {t('offline.home')}
      </Button>
    </>
  );
};

export default OfflinePage;
