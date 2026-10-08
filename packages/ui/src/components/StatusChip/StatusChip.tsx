import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import RemoveCircleOutlined from '@mui/icons-material/RemoveCircleOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { Chip } from '@mui/material';
import type { ReactElement } from 'react';
import type { Status } from '../../theme/types.ts';

// A distinct icon per status, so state never depends on colour alone.
const ICONS: Record<Status, ReactElement> = {
  normal: <CheckCircleOutlined />,
  warning: <WarningAmberOutlined />,
  alarm: <ErrorOutlined />,
  offline: <RemoveCircleOutlined />,
};

export interface StatusChipProps {
  status: Status;
  /** Visible text, e.g. "Alarm" or "Overloaded 112 %". */
  label: string;
  size?: 'small' | 'medium';
}

/** Operational status shown with an icon, text and the matching status colour. */
export const StatusChip = ({ status, label, size = 'small' }: StatusChipProps) => (
  <Chip
    icon={ICONS[status]}
    label={label}
    size={size}
    variant="outlined"
    data-status={status}
    sx={{
      color: `status.${status}`,
      borderColor: `status.${status}`,
      fontWeight: 600,
      '& .MuiChip-icon': { color: 'inherit' },
    }}
  />
);
