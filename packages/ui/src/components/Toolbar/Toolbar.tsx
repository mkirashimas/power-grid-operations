import { Box } from '@mui/material';
import type { ReactNode } from 'react';

export interface ToolbarProps {
  /** Accessible name, e.g. "Table controls". */
  label: string;
  children: ReactNode;
}

/** Groups related controls (filters, toggles, actions) under one accessible name. */
export const Toolbar = ({ label, children }: ToolbarProps) => (
  <Box
    role="toolbar"
    aria-label={label}
    sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
  >
    {children}
  </Box>
);
