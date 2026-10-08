'use client';

import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { Chip } from '@mui/material';

export interface SyntheticBadgeProps {
  /** Translated "Synthetic". */
  label: string;
}

/** Marks generated data, so it is never mistaken for real (e.g. EIA) data. */
export const SyntheticBadge = ({ label }: SyntheticBadgeProps) => (
  <Chip icon={<ScienceOutlined />} label={label} size="small" variant="outlined" />
);
