'use client';

import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { IconButton, useAnnounce } from '@pgo/ui';
import dynamic from 'next/dynamic';
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddAttachmentMutation, useRemoveAttachmentMutation } from '../api';
import { INCIDENTS_NAMESPACE } from '../i18n';
import type { Incident } from '../model';
import { storeUpload, UploadError } from '../storage/uploads';

// The viewer loads when a PDF is opened; pdf.js itself is a further dynamic import.
const PdfViewer = dynamic(() => import('./PdfViewer').then((module) => module.PdfViewer), {
  ssr: false,
});

interface AttachmentsProps {
  incident: Incident;
  /** The open attachment and page, kept in the URL by the report. */
  openId: string | null;
  initialPage: number;
  onOpen: (id: string | null) => void;
  onPageChange: (page: number) => void;
}

const kilobytes = (bytes: number) => Math.max(1, Math.round(bytes / 1024));

/** The report's PDFs: list, upload (kept in this browser) and the pdf.js viewer. */
export const Attachments = ({
  incident,
  openId,
  initialPage,
  onOpen,
  onPageChange,
}: AttachmentsProps) => {
  const { t } = useTranslation(INCIDENTS_NAMESPACE);
  const announce = useAnnounce();
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [addAttachment] = useAddAttachmentMutation();
  const [removeAttachment] = useRemoveAttachmentMutation();
  const open = incident.attachments.find((attachment) => attachment.id === openId);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProblem(null);
    setBusy(true);
    try {
      const attachment = await storeUpload(file);
      await addAttachment({ id: incident.id, attachment }).unwrap();
      announce(t('attachments.added', { name: file.name }));
      onOpen(attachment.id);
    } catch (error) {
      const reason = error instanceof UploadError ? error.problem : 'storage';
      setProblem(t(`attachments.rejected.${reason}`, { name: file.name }));
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    if (id === openId) onOpen(null);
    void removeAttachment({ id: incident.id, attachmentId: id });
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<UploadFileOutlined />}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? t('attachments.attaching') : t('attachments.attach')}
        </Button>
        <Box
          component="input"
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={upload}
          data-testid="attach-input"
          tabIndex={-1}
          aria-hidden
          sx={{ display: 'none' }}
        />
        <Typography variant="body2" color="text.secondary">
          {t('attachments.storedLocally')}
        </Typography>
      </Stack>

      {problem && (
        <Alert severity="error" onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      {incident.attachments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('attachments.empty')}
        </Typography>
      ) : (
        <List dense disablePadding aria-label={t('attachments.list')}>
          {incident.attachments.map((attachment) => (
            <ListItem
              key={attachment.id}
              disablePadding
              secondaryAction={
                <IconButton
                  label={t('attachments.remove', { name: attachment.name })}
                  edge="end"
                  size="small"
                  onClick={() => remove(attachment.id)}
                >
                  <DeleteOutlined fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={attachment.id === openId}
                aria-current={attachment.id === openId ? 'true' : undefined}
                onClick={() => onOpen(attachment.id)}
              >
                <ListItemIcon>
                  <PictureAsPdfOutlined />
                </ListItemIcon>
                <ListItemText
                  primary={attachment.name}
                  secondary={t('attachments.size', { size: kilobytes(attachment.size) })}
                  slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } } }}
                />
                {attachment.source === 'sample' && (
                  <Chip label={t('sample')} size="small" variant="outlined" sx={{ ml: 1 }} />
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}

      {open ? (
        <PdfViewer
          key={open.id}
          attachment={open}
          initialPage={initialPage}
          onPageChange={onPageChange}
          onClose={() => onOpen(null)}
        />
      ) : (
        incident.attachments.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('viewer.select')}
          </Typography>
        )
      )}
    </Stack>
  );
};
