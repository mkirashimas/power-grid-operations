import type { Metadata } from 'next';
import { MapPage } from '../../features/map';
import { MAP_NAMESPACE } from '../../features/map/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(MAP_NAMESPACE);
  return { title: t('title') };
};

export default MapPage;
