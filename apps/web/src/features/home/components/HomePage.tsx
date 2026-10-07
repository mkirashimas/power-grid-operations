import { Typography } from '@mui/material';
import { getServerTranslation } from '../../../i18n/server';
import { HOME_NAMESPACE } from '../i18n';

/** Server component: rendered on the server in the request's language. */
export const HomePage = async () => {
  const t = await getServerTranslation(HOME_NAMESPACE);

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        {t('title')}
      </Typography>
      <Typography color="text.secondary">{t('intro')}</Typography>
    </>
  );
};
