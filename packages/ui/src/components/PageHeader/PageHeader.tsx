'use client';

import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** The page's `h1`. */
  title: string;
  /** One line under the title. */
  intro?: string;
  /** Shown right after the title, e.g. a SyntheticBadge. */
  badge?: ReactNode;
  /** Pinned to the far right of the title row, e.g. a help IconButton. */
  action?: ReactNode;
  /** Extra content under the intro. */
  children?: ReactNode;
}

/** The title block every page starts with: `h1`, optional badge and action, then the intro. */
export const PageHeader = ({ title, intro, badge, action, children }: PageHeaderProps) => (
  <Box>
    <Stack direction="row" useFlexGap sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
      <Stack
        direction="row"
        useFlexGap
        sx={{ flexGrow: 1, minWidth: 0, alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
      >
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {badge}
      </Stack>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
    {intro && <Typography color="text.secondary">{intro}</Typography>}
    {children}
  </Box>
);
