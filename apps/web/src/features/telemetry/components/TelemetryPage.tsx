import { DEFAULT_SEED, EIA_SOURCE, EIA_SOURCE_URL, findSeries } from '@pgo/grid-model';
import { Stack } from '@mui/material';
import { PageHeader, SourceNote } from '@pgo/ui';
import { getServerTranslation } from '../../../i18n/server';
import { HelpButton } from '../../../shell/HelpButton';
import { getErcotData } from '../../../server/eia';
import { TELEMETRY_NAMESPACE } from '../i18n';
import { TelemetryView } from './TelemetryView';

/**
 * Server component: reads the EIA demand curve on the server and hands it to the client
 * view, whose worker shapes the synthetic telemetry with it.
 */
export const TelemetryPage = async () => {
  const [t, { snapshot }] = await Promise.all([
    getServerTranslation(TELEMETRY_NAMESPACE),
    getErcotData(),
  ]);
  const demand = findSeries(snapshot, 'demand')?.points ?? [];

  return (
    <Stack spacing={3}>
      <PageHeader title={t('title')} intro={t('intro')} action={<HelpButton />} />
      <TelemetryView demand={demand} seed={DEFAULT_SEED} />
      <SourceNote prefix={t('source')} name={EIA_SOURCE} href={EIA_SOURCE_URL} />
    </Stack>
  );
};
