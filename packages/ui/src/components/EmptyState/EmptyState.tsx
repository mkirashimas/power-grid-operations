import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** Decorative icon; hidden from screen readers. */
  icon?: ReactNode;
  /** Optional next step, e.g. a "Clear filters" button. */
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}

/** What to show when a view has nothing to display, and what to do about it. */
export const EmptyState = ({ title, body, icon, action, headingLevel = 3 }: EmptyStateProps) => (
  <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 2 }}>
    {icon && (
      <Box aria-hidden sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>
        {icon}
      </Box>
    )}
    <Typography variant="subtitle1" component={`h${headingLevel}`} sx={{ fontWeight: 600 }}>
      {title}
    </Typography>
    {body && (
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '40ch' }}>
        {body}
      </Typography>
    )}
    {action && <Box sx={{ pt: 1 }}>{action}</Box>}
  </Stack>
);
