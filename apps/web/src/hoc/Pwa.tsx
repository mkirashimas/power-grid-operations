'use client';

import CloseOutlined from '@mui/icons-material/CloseOutlined';
import InstallDesktopOutlined from '@mui/icons-material/InstallDesktopOutlined';
import { Alert, Button, Snackbar } from '@mui/material';
import { IconButton } from '@pgo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInstallPrompt } from '../pwa/useInstallPrompt';
import { useOnlineStatus } from '../pwa/useOnlineStatus';
import { useServiceWorker } from '../pwa/useServiceWorker';

/**
 * Top-bar install button: the browser's install prompt where there is one (Chromium), a hint
 * for iOS Safari (Share → Add to Home Screen). Hidden once the app runs installed.
 */
export const InstallButton = () => {
  const { t } = useTranslation('common');
  const { canInstall, showIosHint, install } = useInstallPrompt();
  const [hintOpen, setHintOpen] = useState(false);

  if (!canInstall && !showIosHint) return null;

  return (
    <>
      <IconButton
        label={t('pwa.install')}
        color="inherit"
        onClick={() => (canInstall ? void install() : setHintOpen(true))}
      >
        <InstallDesktopOutlined />
      </IconButton>
      <Snackbar
        open={hintOpen}
        onClose={() => setHintOpen(false)}
        message={t('pwa.iosHint')}
        action={
          <IconButton label={t('pwa.dismiss')} color="inherit" onClick={() => setHintOpen(false)}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        }
      />
    </>
  );
};

/** Says that the app is offline and what still works. */
export const OfflineBanner = () => {
  const { t } = useTranslation('common');
  const online = useOnlineStatus();

  if (online) return null;
  return (
    <Alert severity="warning" role="status" data-testid="offline-banner" sx={{ mb: 2 }}>
      {t('pwa.offline')}
    </Alert>
  );
};

/** Registers the service worker and offers a reload when a new version is waiting. */
export const UpdatePrompt = () => {
  const { t } = useTranslation('common');
  const { updateReady, applyUpdate, dismissUpdate } = useServiceWorker();

  return (
    <Snackbar
      open={updateReady}
      // No auto-hide: the prompt stays until the user reloads or dismisses it.
      onClose={(_, reason) => {
        if (reason !== 'clickaway') dismissUpdate();
      }}
      message={t('pwa.updateReady')}
      action={
        <>
          <Button color="inherit" size="small" onClick={applyUpdate}>
            {t('pwa.reload')}
          </Button>
          <IconButton label={t('pwa.dismiss')} color="inherit" onClick={dismissUpdate}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
};
