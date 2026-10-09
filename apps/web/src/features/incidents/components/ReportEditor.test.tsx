import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Providers } from '../../../hoc/Providers';
import { ReportEditor } from './ReportEditor';

vi.mock('next/navigation', () => ({
  usePathname: () => '/incidents/inc-1',
  useRouter: () => ({ refresh: vi.fn() }),
}));

// jsdom has no layout; ProseMirror measures text to scroll the selection into view.
beforeAll(() => {
  const noRects = () => [] as unknown as DOMRectList;
  Range.prototype.getClientRects = noRects;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Object.assign(Text.prototype, { getClientRects: noRects });
  document.elementFromPoint = () => null;
});

const BODY = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Breaker opened' }] }],
};

const renderEditor = (onSave = vi.fn()) => {
  render(
    <Providers language="en">
      <ReportEditor initialContent={BODY} onSave={onSave} />
    </Providers>,
  );
  return onSave;
};

describe('ReportEditor', () => {
  it('shows the stored text in a labelled, multi-line textbox', async () => {
    renderEditor();
    const editor = await screen.findByRole('textbox', { name: 'Report text' });
    expect(editor).toHaveAttribute('aria-multiline', 'true');
    expect(editor).toHaveTextContent('Breaker opened');
  });

  it('formatting buttons toggle and report their state with aria-pressed', async () => {
    const user = userEvent.setup();
    renderEditor();
    const editor = await screen.findByRole('textbox', { name: 'Report text' });
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' });
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(toolbar).toContainElement(bold);
    expect(bold).toHaveAttribute('aria-pressed', 'false');

    act(() => editor.focus());
    await user.keyboard('{Control>}a{/Control}');
    await user.click(bold);
    expect(bold).toHaveAttribute('aria-pressed', 'true');
    expect(editor.querySelector('strong')).toHaveTextContent('Breaker opened');

    await user.click(bold);
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    expect(editor.querySelector('strong')).toBeNull();
  });

  it('saves the document after a pause in typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onSave = renderEditor();
    const editor = await screen.findByRole('textbox', { name: 'Report text' });
    act(() => editor.focus());
    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: 'Bulleted list' }));
    expect(onSave).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].content[0].type).toBe('bulletList');
    vi.useRealTimers();
  });

  it('rejects unsafe link addresses', async () => {
    const user = userEvent.setup();
    renderEditor();
    const editor = await screen.findByRole('textbox', { name: 'Report text' });
    act(() => editor.focus());
    await user.keyboard('{Control>}a{/Control}');
    await user.click(screen.getByRole('button', { name: 'Link' }));

    const address = await screen.findByRole('textbox', { name: 'Address' });
    await user.type(address, 'javascript:alert(1)');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText('Enter an http, https or mailto address.')).toBeInTheDocument();

    await user.clear(address);
    await user.type(address, 'https://www.ercot.com');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(editor.querySelector('a')).toHaveAttribute('href', 'https://www.ercot.com');
  });
});
