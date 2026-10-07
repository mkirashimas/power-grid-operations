import { Button, Typography } from '@mui/material';
import { getServerTranslation } from '../i18n/server';
import { PATHS } from '../types';

const NotFound = async () => {
  const t = await getServerTranslation();

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        {t('notFound.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('notFound.body')}
      </Typography>
      <Button variant="contained" href={PATHS.HOME}>
        {t('notFound.home')}
      </Button>
    </>
  );
};

export default NotFound;
