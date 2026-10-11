// Presentational components: roles, names and an axe scan each.
import { Button } from '@mui/material';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithTheme } from '../test/utils.tsx';
import { EmptyState } from './EmptyState/EmptyState.tsx';
import { PageHeader } from './PageHeader/PageHeader.tsx';
import { Panel } from './Panel/Panel.tsx';
import { SourceNote } from './SourceNote/SourceNote.tsx';
import { StatCard } from './StatCard/StatCard.tsx';
import { SyntheticBadge } from './SyntheticBadge/SyntheticBadge.tsx';
import { Toolbar } from './Toolbar/Toolbar.tsx';
import { VisuallyHidden } from './VisuallyHidden/VisuallyHidden.tsx';

describe('StatCard', () => {
  it('labels the value with a heading at the requested level', async () => {
    renderWithTheme(
      <StatCard
        label="Demand"
        value="58,657 MW"
        caption="Oct 8, 11:00 AM CDT"
        headingLevel={2}
        badge={<SyntheticBadge label="Synthetic" />}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Demand' })).toBeVisible();
    expect(screen.getByText('58,657 MW')).toBeVisible();
    expect(screen.getByText('Oct 8, 11:00 AM CDT')).toBeVisible();
    expect(screen.getByText('Synthetic')).toBeVisible();
    await expectNoAxeViolations();
  });
});

describe('Panel', () => {
  it('is a region named by its title, with actions', async () => {
    renderWithTheme(
      <Panel title="Telemetry" actions={<Button>Export</Button>}>
        <p>Rows</p>
      </Panel>,
    );

    const region = screen.getByRole('region', { name: 'Telemetry' });
    expect(region).toHaveTextContent('Rows');
    expect(screen.getByRole('heading', { level: 2, name: 'Telemetry' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Export' })).toBeVisible();
    await expectNoAxeViolations();
  });
});

describe('SourceNote', () => {
  it('credits the source with a safe link', async () => {
    renderWithTheme(
      <SourceNote
        prefix="Source:"
        name="U.S. Energy Information Administration"
        href="https://www.eia.gov/opendata/"
        status="live, refreshed hourly"
      />,
    );

    const link = screen.getByRole('link', { name: 'U.S. Energy Information Administration' });
    expect(link).toHaveAttribute('href', 'https://www.eia.gov/opendata/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link.parentElement).toHaveTextContent(
      'Source: U.S. Energy Information Administration · live, refreshed hourly',
    );
    await expectNoAxeViolations();
  });
});

describe('Toolbar', () => {
  it('groups controls under an accessible name', async () => {
    renderWithTheme(
      <Toolbar label="Table controls">
        <Button>Sort</Button>
        <Button>Group</Button>
      </Toolbar>,
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Table controls' });
    expect(toolbar).toContainElement(screen.getByRole('button', { name: 'Group' }));
    await expectNoAxeViolations();
  });
});

describe('EmptyState', () => {
  it('shows a heading, explanation and action, hiding the icon from screen readers', async () => {
    const { container } = renderWithTheme(
      <EmptyState
        title="No assets match"
        body="Try a different filter."
        icon={<svg data-testid="icon" />}
        action={<Button>Clear filters</Button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'No assets match' })).toBeVisible();
    expect(screen.getByText('Try a different filter.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    await expectNoAxeViolations();
  });
});

describe('VisuallyHidden', () => {
  it('keeps text available to assistive technology', () => {
    renderWithTheme(
      <button type="button">
        ✕<VisuallyHidden>Close</VisuallyHidden>
      </button>,
    );
    expect(screen.getByRole('button', { name: '✕Close' })).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('renders the h1 with its badge, action and intro', async () => {
    renderWithTheme(
      <PageHeader
        title="Map"
        intro="The synthetic grid over Texas."
        badge={<SyntheticBadge label="Synthetic" />}
        action={<Button>Help</Button>}
      >
        <p>Extra note</p>
      </PageHeader>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Map' })).toBeVisible();
    expect(screen.getByText('Synthetic')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Help' })).toBeVisible();
    expect(screen.getByText('The synthetic grid over Texas.')).toBeVisible();
    expect(screen.getByText('Extra note')).toBeVisible();
    await expectNoAxeViolations();
  });
});
