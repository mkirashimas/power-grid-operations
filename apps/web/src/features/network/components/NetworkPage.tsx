import { PageHeader, SyntheticBadge } from '@pgo/ui';
import { Stack } from '@mui/material';
import { getServerTranslation } from '../../../i18n/server';
import { HelpButton } from '../../../shell/HelpButton';
import { getRealtimeUrl } from '../../../server/realtime';
import { NETWORK_NAMESPACE } from '../i18n';
import { NetworkView } from './NetworkView';

/**
 * Server component: resolves the realtime service URL per request and renders the network
 * view.
 */
export const NetworkPage = async () => {
  const t = await getServerTranslation(NETWORK_NAMESPACE);

  return (
    <Stack spacing={3}>
      <PageHeader
        title={t('title')}
        intro={t('intro')}
        badge={<SyntheticBadge label={t('synthetic')} />}
        action={<HelpButton />}
      />
      <NetworkView url={getRealtimeUrl()} />
    </Stack>
  );
};
