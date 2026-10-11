import { Box, Stack, Typography } from '@mui/material';
import { PageHeader } from '@pgo/ui';
import { getServerTranslation } from '../../../i18n/server';
import { HelpButton } from '../../../shell/HelpButton';
import { INCIDENTS_NAMESPACE } from '../i18n';
import { IncidentList } from './IncidentList';
import { IncidentReport } from './IncidentReport';
import { NewIncident } from './NewIncident';

const StorageNote = ({ text }: { text: string }) => (
  <Typography variant="body2" color="text.secondary">
    {text}
  </Typography>
);

/** Server component: `/incidents`, the list of reports. */
export const IncidentsPage = async () => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return (
    <Stack spacing={3}>
      <PageHeader title={t('title')} intro={t('intro')} action={<HelpButton />}>
        <Box sx={{ mt: 0.5 }}>
          <StorageNote text={t('storageNote')} />
        </Box>
      </PageHeader>
      <IncidentList />
    </Stack>
  );
};

/** Server component: `/incidents/<id>`, one report. Its data is in the browser (IndexedDB). */
export const IncidentReportPage = async ({ id }: { id: string }) => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return (
    <Stack spacing={2}>
      <IncidentReport id={id} />
      <StorageNote text={t('storageNote')} />
    </Stack>
  );
};

/** Server component: `/incidents/new?asset=<id>`, creates a report and opens it. */
export const NewIncidentPage = async ({ assetId }: { assetId: string | null }) => {
  const t = await getServerTranslation(INCIDENTS_NAMESPACE);
  return (
    <Stack spacing={2}>
      <Typography variant="h4" component="h1">
        {t('title')}
      </Typography>
      <NewIncident assetId={assetId} />
    </Stack>
  );
};
