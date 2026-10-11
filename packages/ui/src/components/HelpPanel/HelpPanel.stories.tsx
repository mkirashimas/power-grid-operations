import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpPanel } from './HelpPanel.tsx';

const meta = {
  title: 'Components/HelpPanel',
  component: HelpPanel,
  // The panel is docked or portaled, so the story frames it with page content, as in the app.
  decorators: [
    (Story) => (
      <Box sx={{ display: 'flex', minHeight: 320 }}>
        <Typography sx={{ flexGrow: 1, p: 2 }}>Page content</Typography>
        <Story />
      </Box>
    ),
  ],
  args: {
    open: true,
    onClose: () => {},
    title: 'About Map',
    closeLabel: 'Close help',
    sections: [
      {
        heading: 'What is this?',
        body: 'A map of Texas showing every substation and power line of the practice grid.',
      },
      {
        heading: 'How do I use it?',
        body: 'Click a dot or a line to select it. The other pages then highlight it too.',
      },
      {
        heading: 'Under the hood',
        items: [
          'MapLibre GL (WebGL) with keyless OpenFreeMap vector tiles.',
          'Colours update every second through feature-state, only for assets that changed.',
        ],
      },
    ],
  },
} satisfies Meta<typeof HelpPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Side: Story = {};

export const Sheet: Story = { args: { variant: 'sheet' } };
