import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { STATUSES } from '../../theme/types.ts';
import { StatusChip } from './StatusChip.tsx';

const meta = {
  title: 'Components/StatusChip',
  component: StatusChip,
  args: { status: 'alarm', label: 'Overloaded 112%' },
  argTypes: { status: { control: 'inline-radio', options: STATUSES } },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every status has its own icon and text, so it never depends on colour alone. */
export const AllStatuses: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <StatusChip status="normal" label="Normal" />
      <StatusChip status="warning" label="Warning 92%" />
      <StatusChip status="alarm" label="Overloaded 112%" />
      <StatusChip status="offline" label="Offline" />
    </Stack>
  ),
};

export const Medium: Story = { args: { size: 'medium' } };
