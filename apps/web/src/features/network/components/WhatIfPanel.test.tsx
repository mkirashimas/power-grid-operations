import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from '../../../hoc/Providers';
import { findAsset, getAssets } from '../../../store/assets';
import { compareStudies, prepareNetwork, runStudy, type StudyEdit } from '../engine/study';
import { StudyResults } from './StudyResults';
import { WhatIfPanel } from './WhatIfPanel';

vi.mock('next/navigation', () => ({
  usePathname: () => '/network',
  useRouter: () => ({ refresh: vi.fn() }),
}));

const wrap = (ui: ReactNode) => render(<Providers language="en">{ui}</Providers>);

const panel = (selectedId: string | null, edits: StudyEdit[] = []) => {
  const handlers = { onApply: vi.fn(), onRemove: vi.fn(), onReset: vi.fn() };
  wrap(<WhatIfPanel selected={findAsset(selectedId)} edits={edits} {...handlers} />);
  return handlers;
};

describe('WhatIfPanel', () => {
  it('asks for a selection first', () => {
    panel(null);
    expect(screen.getByText(/Select a line, substation, load or generator/)).toBeInTheDocument();
    expect(screen.getByText('No changes yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset study' })).toBeDisabled();
  });

  it('trips a line, and offers to restore a tripped one', async () => {
    const user = userEvent.setup();
    const { onApply } = panel('ln-0001');
    await user.click(screen.getByRole('button', { name: 'Trip line' }));
    expect(onApply).toHaveBeenCalledWith({ type: 'trip', assetId: 'ln-0001' });
  });

  it('lists changes with an undo for each', async () => {
    const user = userEvent.setup();
    const edits: StudyEdit[] = [
      { type: 'trip', assetId: 'ln-0001' },
      { type: 'load', assetId: 'sub-cst-001', percent: 20 },
    ];
    const { onRemove, onReset } = panel('ln-0001', edits);
    expect(screen.getByRole('button', { name: 'Restore line' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Changes' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['L0001 CST-001–CST-030 tripped', 'Load at CST-001 138 kV +20 %']);
    await user.click(screen.getByRole('button', { name: 'Undo: Load at CST-001 138 kV +20 %' }));
    expect(onRemove).toHaveBeenCalledWith(edits[1]);
    await user.click(screen.getByRole('button', { name: 'Reset study' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('changes a load through its substation, from the keyboard', async () => {
    const user = userEvent.setup();
    const { onApply } = panel('ld-cst-001');
    const slider = screen.getByRole('slider', { name: 'Load at CST-001 138 kV' });
    expect(slider).toHaveAttribute('aria-valuetext', '0 %');
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onApply).toHaveBeenLastCalledWith({ type: 'load', assetId: 'sub-cst-001', percent: 10 });
  });

  it('takes a generator offline', async () => {
    const user = userEvent.setup();
    const { onApply } = panel('gen-cst-003');
    await user.click(screen.getByRole('button', { name: 'Take offline' }));
    expect(onApply).toHaveBeenCalledWith({ type: 'offline', assetId: 'gen-cst-003' });
  });
});

describe('StudyResults', () => {
  const network = prepareNetwork(getAssets());
  const base = runStudy(network, []);

  it('explains what to do before any change', () => {
    wrap(
      <StudyResults
        hasEdits={false}
        study={base}
        comparison={compareStudies(network, base, base)}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Make a change/)).toBeInTheDocument();
  });

  it('lists the lines that changed most, and selects one on click', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const study = runStudy(network, [{ type: 'trip', assetId: 'ln-0001' }]);
    wrap(
      <StudyResults
        hasEdits
        study={study}
        comparison={compareStudies(network, base, study)}
        onSelect={onSelect}
      />,
    );
    const table = screen.getByRole('table', { name: 'Lines that changed most' });
    expect(within(table).getByRole('row', { name: /L0001 .* Tripped/ })).toBeInTheDocument();
    await user.click(within(table).getByRole('button', { name: 'L0001 CST-001–CST-030' }));
    expect(onSelect).toHaveBeenCalledWith('ln-0001');
    expect(within(screen.getByTestId('study-results')).getByRole('status')).toHaveTextContent(
      /overloads/,
    );
  });
});
