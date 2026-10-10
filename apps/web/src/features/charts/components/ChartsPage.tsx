import { EIA_SOURCE, EIA_SOURCE_URL } from '@pgo/grid-model';
import { Box, Stack, Typography } from '@mui/material';
import { SourceNote } from '@pgo/ui';
import { getServerTranslation } from '../../../i18n/server';
import { getErcotData } from '../../../server/eia';
import { CHARTS_NAMESPACE } from '../i18n';
import { ChartsView } from './ChartsView';

/** Server component: reads ERCOT data from EIA on the server and hands it to the charts. */
export const ChartsPage = async () => {
  const [t, { live, snapshot }] = await Promise.all([
    getServerTranslation(CHARTS_NAMESPACE),
    getErcotData(),
  ]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('intro')}</Typography>
      </Box>
      <ChartsView snapshot={snapshot} />
      <SourceNote
        prefix={t('source')}
        name={EIA_SOURCE}
        href={EIA_SOURCE_URL}
        status={live ? t('live') : undefined}
      />
    </Stack>
  );
};
