import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../../test/utils.tsx';
import { STATUSES } from '../../theme/types.ts';
import { StatusChip } from './StatusChip.tsx';

describe('StatusChip', () => {
  it.each(STATUSES)('shows %s with text and its own icon', async (status) => {
    const { container } = renderWithTheme(<StatusChip status={status} label={`State ${status}`} />);

    expect(screen.getByText(`State ${status}`)).toBeVisible();
    expect(container.querySelector(`[data-status="${status}"] svg`)).not.toBeNull();
    await expectNoAxeViolations();
  });

  it('uses a different icon for every status', () => {
    const icons = STATUSES.map((status) => {
      const { container, unmount } = renderWithTheme(<StatusChip status={status} label={status} />);
      const testId = container.querySelector('svg')?.getAttribute('data-testid');
      unmount();
      return testId;
    });
    expect(new Set(icons).size).toBe(STATUSES.length);
  });
});
