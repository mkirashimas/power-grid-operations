import { Box } from '@mui/material';
import type { ReactNode } from 'react';

// The standard "sr-only" pattern: out of sight, still read by screen readers.
const hidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;

/** Text for screen readers only, e.g. context that sighted users get from layout. */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => (
  <Box component="span" sx={hidden}>
    {children}
  </Box>
);
