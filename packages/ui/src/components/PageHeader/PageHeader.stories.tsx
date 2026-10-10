import HelpOutlined from '@mui/icons-material/HelpOutlined';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../IconButton/IconButton.tsx';
import { SyntheticBadge } from '../SyntheticBadge/SyntheticBadge.tsx';
import { PageHeader } from './PageHeader.tsx';

const meta = {
  title: 'Components/PageHeader',
  component: PageHeader,
  args: {
    title: 'Map',
    intro: 'The synthetic grid over Texas, coloured by live loading.',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBadgeAndAction: Story = {
  args: {
    badge: <SyntheticBadge label="Synthetic" />,
    action: (
      <IconButton label="About this section">
        <HelpOutlined />
      </IconButton>
    ),
  },
};
