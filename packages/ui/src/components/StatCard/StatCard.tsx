import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  /** Optional marker next to the label, e.g. a SyntheticBadge. */
  badge?: ReactNode;
  /** Level of the label heading within the page outline. */
  headingLevel?: 2 | 3 | 4;
}

/** A single figure with its label and context, e.g. "Demand · 58,657 MW · Oct 8, 11:00 CDT". */
export const StatCard = ({ label, value, caption, badge, headingLevel = 3 }: StatCardProps) => (
  <Card variant="outlined">
    <CardContent>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="body2" color="text.secondary" component={`h${headingLevel}`}>
          {label}
        </Typography>
        {badge}
      </Stack>
      <Typography variant="h5" component="p" sx={{ my: 0.5, fontWeight: 600 }}>
        {value}
      </Typography>
      {caption && (
        <Typography variant="caption" color="text.secondary">
          {caption}
        </Typography>
      )}
    </CardContent>
  </Card>
);
