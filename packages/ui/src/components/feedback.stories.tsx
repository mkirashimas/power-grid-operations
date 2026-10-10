// Stories for feedback components: ConfirmDialog, EmptyState and LiveAnnouncer.
import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import { Button, Stack, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog/ConfirmDialog.tsx';
import { EmptyState } from './EmptyState/EmptyState.tsx';
import { LiveAnnouncer, useAnnounce } from './LiveAnnouncer/LiveAnnouncer.tsx';

const meta = {
  title: 'Components/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    open: false,
    title: 'Delete note?',
    body: 'The note will be removed from this incident report.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    destructive: true,
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const DeleteNoteDemo = (args: ConfirmDialogProps) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
        Delete note
      </Button>
      <ConfirmDialog
        {...args}
        open={open}
        onConfirm={() => {
          args.onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          args.onCancel();
          setOpen(false);
        }}
      />
    </>
  );
};

/** Focus stays in the dialog while open; Escape or Cancel closes it. */
export const Default: Story = {
  render: (args) => <DeleteNoteDemo {...args} />,
};

export const EmptyStateStory: Story = {
  name: 'EmptyState',
  render: () => (
    <EmptyState
      icon={<FilterAltOffOutlined />}
      title="No assets match these filters"
      body="Try a different zone or clear the filters to see all 1,869 assets."
      action={<Button variant="outlined">Clear filters</Button>}
    />
  ),
};

const Announcements = () => {
  const announce = useAnnounce();
  const [log, setLog] = useState<string[]>([]);
  const send = (message: string, politeness: 'polite' | 'assertive') => {
    announce(message, politeness);
    setLog((current) => [`${politeness}: ${message}`, ...current].slice(0, 5));
  };
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Stack direction="row" spacing={1}>
        <Button variant="outlined" onClick={() => send('3 new alarms', 'polite')}>
          Announce politely
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => send('Line L0042 overloaded at 112%', 'assertive')}
        >
          Announce urgently
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Screen readers read these aloud. Sent so far: {log.length ? log.join(' | ') : 'nothing'}
      </Typography>
    </Stack>
  );
};

/** One app-wide pair of live regions; components announce through useAnnounce(). */
export const LiveAnnouncerStory: Story = {
  name: 'LiveAnnouncer',
  render: () => (
    <LiveAnnouncer>
      <Announcements />
    </LiveAnnouncer>
  ),
};
