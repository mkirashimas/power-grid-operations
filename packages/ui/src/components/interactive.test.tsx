// Interactive components: keyboard behaviour, state and an axe scan each.
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../test/utils.tsx';
import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog.tsx';
import { FilterField } from './FilterField/FilterField.tsx';
import { HelpPanel } from './HelpPanel/HelpPanel.tsx';
import { LiveAnnouncer, useAnnounce } from './LiveAnnouncer/LiveAnnouncer.tsx';
import { SegmentedControl } from './SegmentedControl/SegmentedControl.tsx';

const ControlledFilter = ({ onChange }: { onChange?: (value: string) => void }) => {
  const [value, setValue] = useState('');
  return (
    <FilterField
      label="Filter assets"
      clearLabel="Clear filter"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
};

describe('FilterField', () => {
  it('filters as you type and clears with the button, returning focus to the input', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ControlledFilter />);

    const input = screen.getByRole('searchbox', { name: 'Filter assets' });
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    await user.type(input, 'coast');
    expect(input).toHaveValue('coast');

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    await expectNoAxeViolations();
  });

  it('clears with Escape', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ControlledFilter />);

    await user.type(screen.getByRole('searchbox', { name: 'Filter assets' }), 'gas{Escape}');
    expect(screen.getByRole('searchbox', { name: 'Filter assets' })).toHaveValue('');
  });
});

describe('SegmentedControl', () => {
  const Engine = ({ onChange }: { onChange: (value: 'js' | 'wasm') => void }) => {
    const [value, setValue] = useState<'js' | 'wasm'>('js');
    return (
      <SegmentedControl
        label="Downsampling engine"
        value={value}
        options={[
          { value: 'js', label: 'JS' },
          { value: 'wasm', label: 'WASM' },
        ]}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  };

  it('marks the selected option and moves between options with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithTheme(<Engine onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Downsampling engine' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'JS' })).toHaveAttribute('aria-pressed', 'true');

    // Roving tabindex: Tab enters the group on the selected option, arrows move within it.
    await user.tab();
    expect(screen.getByRole('button', { name: 'JS' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'WASM' })).toHaveFocus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('wasm');
    expect(screen.getByRole('button', { name: 'WASM' })).toHaveAttribute('aria-pressed', 'true');
    await expectNoAxeViolations();
  });

  it('keeps the selection when the active option is pressed again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithTheme(<Engine onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'JS' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'JS' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ConfirmDialog', () => {
  const props = {
    open: true,
    title: 'Delete note?',
    body: 'The note will be removed from this incident.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  it('is a labelled, described dialog that confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderWithTheme(<ConfirmDialog {...props} onConfirm={onConfirm} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Delete note?' });
    expect(dialog).toHaveAccessibleDescription('The note will be removed from this incident.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await expectNoAxeViolations(dialog);
  });

  it('cancels with Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderWithTheme(<ConfirmDialog {...props} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('keeps focus inside the dialog', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <>
        <button type="button">Outside</button>
        <ConfirmDialog {...props} onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    );

    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
    }
  });
});

describe('LiveAnnouncer', () => {
  const Announcer = () => {
    const announce = useAnnounce();
    return (
      <>
        <button type="button" onClick={() => announce('3 new alarms')}>
          Polite
        </button>
        <button type="button" onClick={() => announce('Line L0042 overloaded', 'assertive')}>
          Urgent
        </button>
      </>
    );
  };

  it('announces politely by default and urgently on request', async () => {
    vi.useFakeTimers();
    renderWithTheme(
      <LiveAnnouncer>
        <Announcer />
      </LiveAnnouncer>,
    );

    act(() => screen.getByRole('button', { name: 'Polite' }).click());
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('status')).toHaveTextContent('3 new alarms');

    act(() => screen.getByRole('button', { name: 'Urgent' }).click());
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole('alert')).toHaveTextContent('Line L0042 overloaded');
    vi.useRealTimers();
  });

  it('fails loudly when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderWithTheme(<Announcer />)).toThrow(/inside <LiveAnnouncer>/);
  });
});

const HELP_SECTIONS = [
  { heading: 'What is this?', body: 'A map of the practice grid.' },
  { heading: 'How do I use it?', body: 'Click an asset to select it.' },
  { heading: 'Under the hood', items: ['MapLibre GL (WebGL)', 'feature-state updates'] },
];

const HelpHarness = ({ variant }: { variant: 'side' | 'sheet' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Help
      </button>
      <HelpPanel
        open={open}
        onClose={() => setOpen(false)}
        title="About Map"
        closeLabel="Close help"
        sections={HELP_SECTIONS}
        variant={variant}
        id="help"
      />
    </>
  );
};

describe('HelpPanel', () => {
  it('side: focuses its heading, closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    renderWithTheme(<HelpHarness variant="side" />);

    await user.click(screen.getByRole('button', { name: 'Help' }));

    const panel = screen.getByRole('complementary', { name: 'About Map' });
    expect(panel).toHaveAttribute('id', 'help');
    expect(screen.getByRole('heading', { level: 2, name: 'About Map' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 3, name: 'What is this?' })).toBeVisible();
    expect(screen.getByText('Click an asset to select it.')).toBeVisible();
    const list = screen.getByRole('list');
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['MapLibre GL (WebGL)', 'feature-state updates']);
    await expectNoAxeViolations();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Help' })).toHaveFocus();
  });

  it('sheet: is a modal that closes with its close button', async () => {
    const user = userEvent.setup();
    renderWithTheme(<HelpHarness variant="sheet" />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('complementary', { name: 'About Map' })).toBeVisible();
    await expectNoAxeViolations();

    await user.click(screen.getByRole('button', { name: 'Close help' }));

    await vi.waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'About Map' })).not.toBeInTheDocument(),
    );
  });
});
