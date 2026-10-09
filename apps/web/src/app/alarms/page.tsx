import type { Metadata } from 'next';
import { AlarmsPage } from '../../features/alarms';
import { ALARMS_NAMESPACE } from '../../features/alarms/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(ALARMS_NAMESPACE);
  return { title: t('title') };
};

export default AlarmsPage;
