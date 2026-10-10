'use client';

import { StatusChip, VisuallyHidden, type Status } from '@pgo/ui';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MAP_NAMESPACE } from '../i18n';
import type { ConnectionStatus } from '../../../store/live/feed';

const CHIP_STATUS: Record<ConnectionStatus, Status> = {
  connecting: 'warning',
  live: 'normal',
  reconnecting: 'warning',
  offline: 'offline',
};

/**
 * Connection state with the latest message latency. Screen readers hear only state changes,
 * not every latency update.
 */
export const ConnectionChip = ({
  status,
  latencyMs,
}: {
  status: ConnectionStatus;
  latencyMs: number | null;
}) => {
  const { t } = useTranslation(MAP_NAMESPACE);
  const label =
    status === 'live' && latencyMs !== null
      ? t('connection.liveLatency', { ms: Math.round(latencyMs) })
      : t(`connection.${status}`);

  return (
    <Box data-testid="connection-status" data-state={status}>
      <Box aria-hidden>
        <StatusChip status={CHIP_STATUS[status]} label={label} />
      </Box>
      <VisuallyHidden>
        <span role="status">{t(`connection.${status}`)}</span>
      </VisuallyHidden>
    </Box>
  );
};
