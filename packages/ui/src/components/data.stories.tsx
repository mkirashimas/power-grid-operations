// Stories for the small data-labelling components.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SourceNote } from './SourceNote/SourceNote.tsx';
import { SyntheticBadge } from './SyntheticBadge/SyntheticBadge.tsx';

const meta = {
  title: 'Components/SourceNote',
  component: SourceNote,
  args: {
    prefix: 'Source:',
    name: 'U.S. Energy Information Administration',
    href: 'https://www.eia.gov/opendata/',
    status: 'live, refreshed hourly',
  },
} satisfies Meta<typeof SourceNote>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const Snapshot: Story = { args: { status: 'snapshot of Oct 8, 2026' } };

/** SyntheticBadge marks generated data so it is never mistaken for EIA data. */
export const WithSyntheticBadge: Story = {
  render: (args) => (
    <>
      <SyntheticBadge label="Synthetic" />
      <SourceNote {...args} />
    </>
  ),
};
