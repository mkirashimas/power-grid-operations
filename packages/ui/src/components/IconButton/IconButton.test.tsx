import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../../test/utils.tsx';
import { IconButton } from './IconButton.tsx';

describe('IconButton', () => {
  it('uses the label as accessible name and tooltip', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <IconButton label="Delete asset">
        <DeleteOutlined />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Delete asset' });
    await user.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Delete asset');
    await expectNoAxeViolations();
  });

  it('is reachable with Tab and activates with Enter and Space', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderWithTheme(
      <IconButton label="Delete asset" onClick={onClick}>
        <DeleteOutlined />
      </IconButton>,
    );

    await user.tab();
    expect(screen.getByRole('button', { name: 'Delete asset' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('stays named when disabled', () => {
    renderWithTheme(
      <IconButton label="Delete asset" disabled>
        <DeleteOutlined />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Delete asset' })).toBeDisabled();
  });
});
