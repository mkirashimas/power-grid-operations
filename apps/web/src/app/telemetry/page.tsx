import type { Metadata } from 'next';
import { TelemetryPage } from '../../features/telemetry';
import { TELEMETRY_NAMESPACE } from '../../features/telemetry/i18n';
import { getServerTranslation } from '../../i18n/server';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getServerTranslation(TELEMETRY_NAMESPACE);
  return { title: t('title') };
};

export default TelemetryPage;
