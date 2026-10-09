import type { Metadata } from 'next';
import { IncidentsPage } from '../../features/incidents';
import { INCIDENTS_NAMESPACE } from '../../features/incidents/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return { title: t('title') };
};

export default IncidentsPage;
