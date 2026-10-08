// Theme foundations: colour tokens, typography and the MUI components the app uses directly.
// Switch Light/Dark in the toolbar: every swatch reads the active scheme's CSS variables.
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta = { title: 'Foundations' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TOKEN_GROUPS: { title: string; tokens: string[] }[] = [
  {
    title: 'Surfaces',
    tokens: ['background.default', 'background.paper', 'surface.sidebar', 'divider'],
  },
  { title: 'Text', tokens: ['text.primary', 'text.secondary', 'primary.main', 'secondary.main'] },
  {
    title: 'Status',
    tokens: ['status.normal', 'status.warning', 'status.alarm', 'status.offline'],
  },
  { title: 'Feedback', tokens: ['error.main', 'warning.main', 'info.main', 'success.main'] },
];

const Swatch = ({ token }: { token: string }) => (
  <Stack spacing={0.5} sx={{ width: 140 }}>
    <Box sx={{ height: 56, borderRadius: 1, bgcolor: token, border: 1, borderColor: 'divider' }} />
    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
      {token}
    </Typography>
  </Stack>
);

/** Colour tokens. Features use only these, never raw colour values. */
export const Colors: Story = {
  render: () => (
    <Stack spacing={3}>
      {TOKEN_GROUPS.map(({ title, tokens }) => (
        <Box key={title}>
          <Typography variant="subtitle1" component="h2" sx={{ mb: 1, fontWeight: 600 }}>
            {title}
          </Typography>
          <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: 'wrap' }}>
            {tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  ),
};

const VARIANTS = ['h4', 'h5', 'h6', 'subtitle1', 'body1', 'body2', 'caption', 'button'] as const;

/** Type scale. Page titles use h4 (h5 size on phones), sections h6, figures h5. */
export const TypographyScale: Story = {
  name: 'Typography',
  render: () => (
    <Stack spacing={1.5}>
      {VARIANTS.map((variant) => (
        <Stack key={variant} direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ width: 80, fontFamily: 'monospace' }}
          >
            {variant}
          </Typography>
          <Typography variant={variant} component="p">
            ERCOT demand 58,657 MW
          </Typography>
        </Stack>
      ))}
    </Stack>
  ),
};

const MuiComponentsDemo = () => {
  const [tab, setTab] = useState(0);
  const [zone, setZone] = useState('coast');
  const [open, setOpen] = useState(false);
  return (
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button variant="contained">Contained</Button>
        <Button variant="outlined">Outlined</Button>
        <Button>Text</Button>
        <Button variant="contained" color="error">
          Destructive
        </Button>
        <Button variant="contained" disabled>
          Disabled
        </Button>
      </Stack>
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <TextField label="Asset name" size="small" defaultValue="CST-014 345 kV" />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="zone-label">Weather zone</InputLabel>
          <Select
            labelId="zone-label"
            label="Weather zone"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
          >
            <MenuItem value="coast">Coast</MenuItem>
            <MenuItem value="far-west">Far West</MenuItem>
            <MenuItem value="north-central">North Central</MenuItem>
          </Select>
        </FormControl>
      </Stack>
      <Box>
        <Tabs value={tab} onChange={(_, next: number) => setTab(next)} aria-label="Chart views">
          <Tab label="Forecast vs actual" />
          <Tab label="By fuel" />
          <Tab label="Interchange" />
        </Tabs>
      </Box>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Opens the incident report">
          <Button variant="outlined">Hover or focus me</Button>
        </Tooltip>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Open dialog
        </Button>
      </Stack>
      <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="demo-dialog-title">
        <DialogTitle id="demo-dialog-title">Dialog title</DialogTitle>
        <DialogContent>
          <Typography>Dialogs trap focus and close with Escape.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

/** Themed MUI components used directly by the app, without a wrapper. */
export const MuiComponents: Story = {
  name: 'MUI components',
  render: () => <MuiComponentsDemo />,
};
