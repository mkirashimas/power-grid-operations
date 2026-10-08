import { Box, Paper, Stack, Typography } from '@mui/material';
import { useId, type ReactNode } from 'react';

export interface PanelProps {
  title: string;
  /** Level of the title heading within the page outline. */
  headingLevel?: 2 | 3 | 4;
  /** Controls shown at the right of the header, e.g. a Toolbar or IconButtons. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A titled region of a page. Screen readers list it as a landmark named by its title. */
export const Panel = ({ title, headingLevel = 2, actions, children }: PanelProps) => {
  const headingId = useId();
  return (
    <Paper component="section" variant="outlined" aria-labelledby={headingId} sx={{ p: 2 }}>
      <Stack
        direction="row"
        useFlexGap
        sx={{
          mb: 2,
          gap: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Typography id={headingId} variant="h6" component={`h${headingLevel}`}>
          {title}
        </Typography>
        {actions && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{actions}</Box>}
      </Stack>
      {children}
    </Paper>
  );
};
