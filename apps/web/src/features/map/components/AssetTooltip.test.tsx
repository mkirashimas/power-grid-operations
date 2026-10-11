import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../../../hoc/Providers';
import { getI18n } from '../../../i18n';
import { findAsset } from '../../../store/assets';
import { AssetTooltip } from './AssetTooltip';

const asset = findAsset('sub-cst-001')!;

const renderTooltip = (loadingPct?: number, voltagePu?: number) =>
  render(
    <Providers language="en">
      <AssetTooltip asset={asset} loadingPct={loadingPct} voltagePu={voltagePu} />
    </Providers>,
  );

describe('AssetTooltip', () => {
  it('shows the asset, its status and live values', () => {
    renderTooltip(95.25, 1.0123);

    const tooltip = screen.getByTestId('map-asset-tooltip');
    expect(tooltip).toHaveTextContent(asset.name);
    expect(tooltip).toHaveTextContent('Substation · Coast');
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('95.3 %');
    expect(tooltip).toHaveTextContent('1.012 pu');
    expect(tooltip).toHaveTextContent(`${asset.capacityMw.toLocaleString('en')} MW`);
  });

  it('shows dashes and no status before the feed has sent values', () => {
    renderTooltip();

    const tooltip = screen.getByTestId('map-asset-tooltip');
    expect(tooltip).toHaveTextContent('Loading–');
    expect(tooltip).toHaveTextContent('Voltage–');
    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });

  // Runs last: the browser i18n instance is shared, so the language change sticks.
  it('formats numbers for the active language', async () => {
    renderTooltip(95.25, 1.0123);
    await act(() => getI18n('en').changeLanguage('ro'));

    const tooltip = screen.getByTestId('map-asset-tooltip');
    expect(tooltip).toHaveTextContent('Stație · Coastă');
    expect(tooltip).toHaveTextContent('95,3 %');
    expect(tooltip).toHaveTextContent('1,012 pu');
  });
});
