import { PageHeader, SyntheticBadge } from '@pgo/ui';
import { Stack } from '@mui/material';
import { getServerTranslation } from '../../../i18n/server';
import { HelpButton } from '../../../shell/HelpButton';
import { getRealtimeUrl } from '../../../server/realtime';
import { ALARMS_NAMESPACE } from '../i18n';
import { AlarmsView } from './AlarmsView';

/** Server component: resolves the realtime service URL per request and renders the live feed. */
export const AlarmsPage = async () => {
  const t = await getServerTranslation(ALARMS_NAMESPACE);

  return (
    <Stack spacing={3}>
      <PageHeader
        title={t('title')}
        intro={t('intro')}
        badge={<SyntheticBadge label={t('synthetic')} />}
        action={<HelpButton />}
      />
      <AlarmsView url={getRealtimeUrl()} />
    </Stack>
  );
};
