import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SyntheticBadge } from '../SyntheticBadge/SyntheticBadge.tsx';
import { StatCard } from './StatCard.tsx';

const meta = {
  title: 'Components/StatCard',
  component: StatCard,
  args: { label: 'Demand', value: '58,657 MW', caption: 'Oct 8, 11:00 AM CDT' },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBadge: Story = {
  args: {
    label: 'Substations',
    value: '400',
    caption: undefined,
    badge: <SyntheticBadge label="Synthetic" />,
  },
};

/** Cards size themselves from the available width, so no breakpoints are needed. */
export const Grid: Story = {
  render: () => (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
        gap: 2,
      }}
    >
      <StatCard label="Demand" value="58,657 MW" caption="Oct 8, 11:00 AM CDT" />
      <StatCard label="Day-ahead forecast" value="58,112 MW" caption="Oct 8, 11:00 AM CDT" />
      <StatCard
        label="Forecast error"
        value="+0.9%"
        caption="Actual demand vs the day-ahead forecast"
      />
      <StatCard label="Net interchange" value="-792 MW" caption="negative means net import" />
    </Box>
  ),
};
