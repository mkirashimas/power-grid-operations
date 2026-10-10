import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IconButton } from './IconButton.tsx';

const meta = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'Refresh data', onClick: fn(), children: <RefreshOutlined /> },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = { args: { disabled: true } };

export const Variants: Story = {
  render: (args) => (
    <Stack direction="row" spacing={1}>
      <IconButton {...args} label="Refresh data">
        <RefreshOutlined />
      </IconButton>
      <IconButton {...args} label="Switch to dark mode">
        <DarkModeOutlined />
      </IconButton>
      <IconButton {...args} label="Delete incident" color="error">
        <DeleteOutlined />
      </IconButton>
      <IconButton {...args} label="Refresh data" size="small">
        <RefreshOutlined fontSize="small" />
      </IconButton>
    </Stack>
  ),
};
