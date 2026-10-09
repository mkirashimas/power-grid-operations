import { SyntheticBadge } from '@pgo/ui';
import { Box, Link, Stack, Typography } from '@mui/material';
import { getServerTranslation } from '../../../i18n/server';
import { getRealtimeUrl } from '../../../server/realtime';
import { MAP_NAMESPACE } from '../i18n';
import { MapView } from './MapView';

/** Server component: resolves the realtime service URL per request and renders the live map. */
export const MapPage = async () => {
  const t = await getServerTranslation(MAP_NAMESPACE);

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
      <MapView url={getRealtimeUrl()} />
      <Typography variant="body2" color="text.secondary">
        {t('credit.prefix')}{' '}
        <Link href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">
          OpenFreeMap
        </Link>
        {', © '}
        <Link href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">
          OpenMapTiles
        </Link>
        {', '}
        {t('credit.data')}{' '}
        <Link
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('credit.osm')}
        </Link>
      </Typography>
    </Stack>
  );
};
