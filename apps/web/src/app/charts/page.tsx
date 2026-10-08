import type { Metadata } from 'next';
import { ChartsPage } from '../../features/charts';
import { CHARTS_NAMESPACE } from '../../features/charts/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(CHARTS_NAMESPACE);
  return { title: t('title') };
};

export default ChartsPage;
