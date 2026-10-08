import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../IconButton/IconButton.tsx';
import { Panel } from './Panel.tsx';

const meta = {
  title: 'Components/Panel',
  component: Panel,
  args: {
    title: 'Telemetry',
    children: (
      <Typography color="text.secondary">1,076,544 rows from 1,869 synthetic assets.</Typography>
    ),
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <>
        <IconButton label="Refresh">
          <RefreshOutlined />
        </IconButton>
        <IconButton label="Export CSV">
          <FileDownloadOutlined />
        </IconButton>
      </>
    ),
  },
};
