import type { Metadata } from 'next';
import { IncidentReportPage } from '../../../features/incidents';
import { INCIDENTS_NAMESPACE } from '../../../features/incidents/i18n';
import { getServerTranslation } from '../../../i18n/server';

// Reports live in the visitor's browser, so the server only knows the generic title.
export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return { title: t('title') };
};

const Page = async ({ params }: PageProps<'/incidents/[id]'>) => {
  const { id } = await params;
  return <IncidentReportPage id={id} />;
};

export default Page;
