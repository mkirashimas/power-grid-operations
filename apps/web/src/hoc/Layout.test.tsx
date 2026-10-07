import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';
import { Providers } from './Providers';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh }),
}));

const renderLayout = () =>
  render(
    <Providers language="en">
      <Layout>
        <p>Page content</p>
      </Layout>
    </Providers>,
  );

describe('Layout', () => {
  beforeEach(() => {
    refresh.mockClear();
    document.cookie = 'lang=; max-age=0; path=/';
  });

  it('renders the app shell around the page', () => {
    renderLayout();

    expect(screen.getByRole('link', { name: 'Power Grid Operations' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Page content');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('marks the current section in the navigation', () => {
    renderLayout();

    const [desktopNav] = screen.getAllByRole('navigation', { name: 'Main navigation' });
    expect(within(desktopNav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('toggles the color scheme', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));

    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  // Runs last: the browser i18n instance is shared, so the language change sticks.
  it('switches language, stores it in a cookie and refreshes server components', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    await user.click(screen.getByRole('option', { name: 'Română' }));

    expect(document.cookie).toContain('lang=ro');
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('combobox', { name: 'Limbă' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ro');
  });
});
