import { SyntheticBadge } from '@pgo/ui';
import { Box, Stack, Typography } from '@mui/material';
import { getServerTranslation } from '../../../i18n/server';
import { getRealtimeUrl } from '../../../server/realtime';
import { ALARMS_NAMESPACE } from '../i18n';
import { AlarmsView } from './AlarmsView';

/** Server component: resolves the realtime service URL per request and renders the live feed. */
export const AlarmsPage = async () => {
  const t = await getServerTranslation(ALARMS_NAMESPACE);

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" component="h1">
            {t('title')}
          </Typography>
          <SyntheticBadge label={t('synthetic')} />
        </Stack>
        <Typography color="text.secondary">{t('intro')}</Typography>
      </Box>
      <AlarmsView url={getRealtimeUrl()} />
    </Stack>
  );
};
