// Stories for controls: Toolbar, FilterField and SegmentedControl working together.
import BoltOutlined from '@mui/icons-material/BoltOutlined';
import CodeOutlined from '@mui/icons-material/CodeOutlined';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FilterField } from './FilterField/FilterField.tsx';
import { SegmentedControl } from './SegmentedControl/SegmentedControl.tsx';
import { Toolbar } from './Toolbar/Toolbar.tsx';

const meta = {
  title: 'Components/Toolbar',
  component: Toolbar,
  args: { label: 'Chart controls', children: null },
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const Filter = () => {
  const [value, setValue] = useState('');
  return (
    <FilterField
      label="Filter assets"
      clearLabel="Clear filter"
      placeholder="Name, zone or id"
      value={value}
      onChange={setValue}
    />
  );
};

const Engine = () => {
  const [value, setValue] = useState<'js' | 'wasm'>('wasm');
  return (
    <SegmentedControl
      label="Downsampling engine"
      value={value}
      onChange={setValue}
      options={[
        { value: 'js', label: 'JS', icon: <CodeOutlined fontSize="small" /> },
        { value: 'wasm', label: 'WASM', icon: <BoltOutlined fontSize="small" /> },
      ]}
    />
  );
};

/** A toolbar groups related controls under one accessible name. */
export const WithControls: Story = {
  render: (args) => (
    <Toolbar label={args.label}>
      <Filter />
      <Engine />
    </Toolbar>
  ),
};

/** Type to filter; the clear button or Escape empties the field and keeps focus in it. */
export const FilterFieldStory: Story = { name: 'FilterField', render: () => <Filter /> };

/** Arrow keys move between options; pressing the active option keeps it selected. */
export const SegmentedControlStory: Story = {
  name: 'SegmentedControl',
  render: () => <Engine />,
};
