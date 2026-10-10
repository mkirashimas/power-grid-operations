import { EIA_SOURCE, EIA_SOURCE_URL } from '@pgo/grid-model';
import { Stack } from '@mui/material';
import { PageHeader, SourceNote } from '@pgo/ui';
import { getServerTranslation } from '../../../i18n/server';
import { HelpButton } from '../../../shell/HelpButton';
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
      <PageHeader title={t('title')} intro={t('intro')} action={<HelpButton />} />
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
