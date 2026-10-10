import type { Metadata } from 'next';
import { NetworkPage } from '../../features/network';
import { NETWORK_NAMESPACE } from '../../features/network/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(NETWORK_NAMESPACE);
  return { title: t('title') };
};

export default NetworkPage;
