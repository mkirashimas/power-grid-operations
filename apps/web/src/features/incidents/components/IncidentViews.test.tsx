import 'fake-indexeddb/auto';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Providers } from '../../../hoc/Providers';
import { createIncident } from '../model';
import { SAMPLE_INCIDENTS } from '../seed';
import { closeIncidentsDb, DB_NAME, getFile } from '../storage/db';
import { Attachments } from './Attachments';
import { IncidentList } from './IncidentList';
import { ReportHeader } from './ReportHeader';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/incidents',
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const wrap = (ui: ReactNode) => render(<Providers language="en">{ui}</Providers>);

afterEach(async () => {
  push.mockClear();
  window.history.replaceState(null, '', '/');
  await closeIncidentsDb();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
  });
});

describe('IncidentList', () => {
  const table = () => screen.findByRole('table', { name: 'Incident reports' });

  it('lists the samples and filters them', async () => {
    const user = userEvent.setup();
    wrap(<IncidentList />);
    expect(within(await table()).getAllByRole('row')).toHaveLength(8);

    await user.type(screen.getByRole('searchbox', { name: 'Search reports' }), 'insulator');
    expect(within(await table()).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Reports: 1')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search reports' }), ' nothing');
    expect(await screen.findByText('No report matches these filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(within(await table()).getAllByRole('row')).toHaveLength(8);
  });

  it('creates a report and opens it', async () => {
    const user = userEvent.setup();
    wrap(<IncidentList />);
    await table();
    await user.click(screen.getByRole('button', { name: 'New incident' }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/incidents\/inc-/)),
    );
  });

  it('asks before resetting the demo data', async () => {
    const user = userEvent.setup();
    wrap(<IncidentList />);
    await table();
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset demo data?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ReportHeader', () => {
  it('saves header changes and links assets to the selection', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    wrap(<ReportHeader incident={SAMPLE_INCIDENTS[0]} onSave={onSave} />);

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Open' }));
    expect(onSave).toHaveBeenCalledWith({ status: 'open' });

    const assets = screen.getByRole('list', { name: 'Assets' });
    const chip = within(assets).getByRole('button', { name: 'CST-001 138 kV' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the title after a pause, and never an empty one', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSave = vi.fn();
    wrap(<ReportHeader incident={createIncident({ title: 'Trip' })} onSave={onSave} />);
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(onSave).toHaveBeenLastCalledWith({ title: 'Untitled incident' });
    vi.useRealTimers();
  });
});

describe('Attachments', () => {
  const setup = () => {
    const onOpen = vi.fn();
    const incident = SAMPLE_INCIDENTS[2];
    wrap(
      <Attachments
        incident={incident}
        openId={null}
        initialPage={1}
        onOpen={onOpen}
        onPageChange={vi.fn()}
      />,
    );
    return { onOpen, input: screen.getByTestId('attach-input') as HTMLInputElement };
  };

  it('rejects a file that is not a PDF', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input, onOpen } = setup();
    await user.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByText('notes.txt is not a PDF.')).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('stores a PDF in the browser and opens it', async () => {
    const user = userEvent.setup();
    const { input, onOpen } = setup();
    const file = new File(['%PDF-1.7\n'], 'record.pdf', { type: 'application/pdf' });
    await user.upload(input, file);
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(expect.stringMatching(/^att-/)));
    const id = onOpen.mock.calls[0][0] as string;
    // Stored in IndexedDB (storage/db.test.ts checks the bytes in Node, where Blobs clone).
    expect(await getFile(id)).toBeDefined();
  });
});
