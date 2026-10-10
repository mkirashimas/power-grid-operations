import type { Metadata } from 'next';
import { NewIncidentPage } from '../../../features/incidents';
import { INCIDENTS_NAMESPACE } from '../../../features/incidents/i18n';
import { getServerTranslation } from '../../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return { title: t('title') };
};

const Page = async ({ searchParams }: PageProps<'/incidents/new'>) => {
  const { asset } = await searchParams;
  return <NewIncidentPage assetId={typeof asset === 'string' ? asset : null} />;
};

export default Page;
