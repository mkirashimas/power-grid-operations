import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpButton } from '../shell/HelpButton';
import { Layout } from './Layout';
import { Providers } from './Providers';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh }),
}));

const renderLayout = (sidebarCollapsed?: boolean) =>
  render(
    <Providers language="en" sidebarCollapsed={sidebarCollapsed}>
      <Layout>
        <p>Page content</p>
        <HelpButton />
      </Layout>
    </Providers>,
  );

const desktopNav = () => screen.getAllByRole('navigation', { name: 'Main navigation' })[0];

describe('Layout', () => {
  beforeEach(() => {
    refresh.mockClear();
    document.cookie = 'lang=; max-age=0; path=/';
    document.cookie = 'sidebar=; max-age=0; path=/';
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

  it('collapses the sidebar to an icon rail and remembers it in a cookie', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(within(desktopNav()).getByRole('button', { name: 'Collapse menu' }));

    expect(document.cookie).toContain('sidebar=collapsed');
    const link = within(desktopNav()).getByRole('link', { name: 'Overview' });
    expect(link).not.toHaveTextContent('Overview');

    await user.click(within(desktopNav()).getByRole('button', { name: 'Expand menu' }));

    expect(document.cookie).toContain('sidebar=expanded');
    expect(within(desktopNav()).getByRole('link', { name: 'Overview' })).toHaveTextContent(
      'Overview',
    );
  });

  it('starts as a rail when the server read a collapsed cookie', () => {
    renderLayout(true);

    expect(within(desktopNav()).getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();
  });

  it('opens section help beside the page, folding the sidebar until it closes', async () => {
    const user = userEvent.setup();
    renderLayout();

    const helpButton = screen.getByRole('button', { name: 'About this section' });
    await user.click(helpButton);

    const panel = screen.getByRole('complementary', { name: 'About Overview' });
    expect(helpButton).toHaveAttribute('aria-expanded', 'true');
    expect(helpButton).toHaveAttribute('aria-controls', panel.id);
    expect(within(panel).getByRole('heading', { name: 'What is this?' })).toBeVisible();
    expect(within(panel).getByRole('heading', { name: 'Under the hood' })).toBeVisible();
    expect(within(within(panel).getByRole('list')).getAllByRole('listitem')).toHaveLength(4);
    expect(within(desktopNav()).getByRole('button', { name: 'Expand menu' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(helpButton).toHaveAttribute('aria-expanded', 'false');
    expect(helpButton).toHaveFocus();
    expect(within(desktopNav()).getByRole('button', { name: 'Collapse menu' })).toBeInTheDocument();
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
