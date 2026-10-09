'use client';

import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findAsset } from '../../../store/assets';
import { PATHS } from '../../../types';
import { useCreateIncidentMutation } from '../api';
import { INCIDENTS_NAMESPACE } from '../i18n';

/** Creates a report (for an asset, from the selection bar's "Report incident") and opens it. */
export const NewIncident = ({ assetId }: { assetId: string | null }) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const router = useRouter();
  const [createIncident] = useCreateIncidentMutation();
  const [failed, setFailed] = useState(false);
  // Strict mode runs effects twice in development; create one report only.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const asset = findAsset(assetId);
    createIncident({
      title: asset ? `${asset.name}: ${t('list.untitled')}` : t('list.untitled'),
      assetIds: asset ? [asset.id] : [],
    })
      .unwrap()
      .then((incident) => router.replace(PATHS.incident(incident.id)))
      .catch(() => setFailed(true));
  }, [assetId, createIncident, router, t]);

  return (
    <Stack spacing={2} sx={{ alignItems: 'center', py: 8 }}>
      {failed ? (
        <>
          <Alert severity="error">{t('newIncident.error')}</Alert>
          <Button component={NextLink} href={PATHS.INCIDENTS} variant="outlined">
            {t('newIncident.back')}
          </Button>
        </>
      ) : (
        <>
          <CircularProgress size={28} aria-hidden />
          <Typography color="text.secondary" role="status">
            {t('newIncident.creating')}
          </Typography>
        </>
      )}
    </Stack>
  );
};
