'use client';

import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import ReportOutlined from '@mui/icons-material/ReportOutlined';
import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { ConfirmDialog, EmptyState, Panel } from '@pgo/ui';
import type { JSONContent } from '@tiptap/core';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { replaceSearchParams } from '../../../store/url';
import { PATHS } from '../../../types';
import { useDeleteIncidentMutation, useGetIncidentQuery, useUpdateIncidentMutation } from '../api';
import { INCIDENTS_NAMESPACE } from '../i18n';
import type { Incident, IncidentChanges } from '../model';
import {
  REPORT_SEARCH_KEYS,
  viewerFromSearchParams,
  viewerToSearchParams,
  type ViewerLocation,
} from '../url';
import { Attachments } from './Attachments';
import { ReportEditor } from './ReportEditor';
import { ReportHeader } from './ReportHeader';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Header changes and the text autosave share one save status. */
const useSave = (id: string) => {
  const [update] = useUpdateIncidentMutation();
  const [state, setState] = useState<SaveState>('idle');
  const inFlight = useRef(0);
  const save = useCallback(
    (changes: IncidentChanges) => {
      inFlight.current += 1;
      setState('saving');
      update({ id, changes })
        .unwrap()
        .then(() => {
          inFlight.current -= 1;
          if (inFlight.current === 0) setState('saved');
        })
        .catch(() => {
          inFlight.current -= 1;
          setState('error');
        });
    },
    [id, update],
  );
  return { save, state };
};

/** The open attachment and page, kept in the URL (`doc`, `page`). */
const useViewerLocation = () => {
  const searchParams = useSearchParams();
  const [initial] = useState(() =>
    viewerFromSearchParams(new URLSearchParams(searchParams.toString())),
  );
  const [location, setLocation] = useState<ViewerLocation>(initial);
  const skipWrite = useRef(true);
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    replaceSearchParams(REPORT_SEARCH_KEYS, viewerToSearchParams(location));
  }, [location]);
  return { initial, location, setLocation };
};

const Report = ({ incident }: { incident: Incident }) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const router = useRouter();
  const { save, state } = useSave(incident.id);
  const { initial, location, setLocation } = useViewerLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteIncident] = useDeleteIncidentMutation();
  const saveBody = useCallback((body: JSONContent) => save({ body }), [save]);

  // A doc in the URL that isn't attached (any more) is dropped.
  const openId = incident.attachments.some(({ id }) => id === location.doc) ? location.doc : null;

  const remove = () => {
    setConfirmDelete(false);
    // Leave first, so the page never shows the deleted report as missing.
    router.push(PATHS.INCIDENTS);
    void deleteIncident(incident.id);
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button component={NextLink} href={PATHS.INCIDENTS} startIcon={<ArrowBackOutlined />}>
          {t('report.back')}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Typography
          variant="body2"
          color={state === 'error' ? 'error' : 'text.secondary'}
          role="status"
          data-testid="save-status"
        >
          {state === 'saving' && t('report.saving')}
          {state === 'saved' && t('report.saved')}
          {state === 'error' && t('report.saveError')}
        </Typography>
        <Button color="error" startIcon={<DeleteOutlined />} onClick={() => setConfirmDelete(true)}>
          {t('report.delete')}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          {incident.title}
        </Typography>
        {incident.sample && <Chip label={t('sample')} size="small" variant="outlined" />}
      </Stack>

      <Panel title={t('report.details')} headingLevel={2}>
        <ReportHeader incident={incident} onSave={save} />
      </Panel>

      <Box
        sx={(theme) => ({
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          [theme.breakpoints.down('lg')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
        })}
      >
        <Panel title={t('editor.heading')} headingLevel={2}>
          <ReportEditor initialContent={incident.body} onSave={saveBody} />
        </Panel>
        <Panel title={t('attachments.title')} headingLevel={2}>
          <Attachments
            incident={incident}
            openId={openId}
            initialPage={openId && openId === initial.doc ? initial.page : 1}
            onOpen={(doc) => setLocation({ doc, page: 1 })}
            onPageChange={(page) => setLocation((current) => ({ ...current, page }))}
          />
        </Panel>
      </Box>

      <ConfirmDialog
        open={confirmDelete}
        title={t('report.deleteTitle')}
        body={t('report.deleteBody')}
        confirmLabel={t('report.deleteConfirm')}
        cancelLabel={t('report.cancel')}
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </Stack>
  );
};

/** One incident report, loaded from IndexedDB. */
export const IncidentReport = ({ id }: { id: string }) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const { data: incident, isLoading, isError } = useGetIncidentQuery(id);

  if (isLoading) {
    return (
      <Stack spacing={1} sx={{ alignItems: 'center', py: 8 }}>
        <CircularProgress size={28} aria-hidden />
        <Typography color="text.secondary">{t('report.loading')}</Typography>
      </Stack>
    );
  }
  if (isError || !incident) {
    return (
      <Stack spacing={3}>
        <Typography variant="h4" component="h1">
          {t('title')}
        </Typography>
        <EmptyState
          icon={<ReportOutlined />}
          title={t('report.notFound')}
          body={t('report.notFoundBody')}
          headingLevel={2}
          action={
            <Button component={NextLink} href={PATHS.INCIDENTS} variant="outlined">
              {t('report.back')}
            </Button>
          }
        />
      </Stack>
    );
  }
  // Keyed, so the editor starts again from a different report's text.
  return <Report key={incident.id} incident={incident} />;
};
