import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../../../hoc/Providers';
import { findAsset } from '../../../store/assets';
import { GraphTooltip, type GraphTooltipProps } from './GraphTooltip';

const substation = findAsset('sub-cst-001')!;
const line = findAsset('ln-0001')!;

const renderTooltip = (props: Partial<GraphTooltipProps> & Pick<GraphTooltipProps, 'asset'>) =>
  render(
    <Providers language="en">
      <GraphTooltip
        status="normal"
        loadingPct={undefined}
        voltagePu={undefined}
        study={false}
        tripped={false}
        deEnergized={false}
        {...props}
      />
    </Providers>,
  );

describe('GraphTooltip', () => {
  it('shows a substation with its live values', () => {
    renderTooltip({ asset: substation, status: 'warning', loadingPct: 92.04, voltagePu: 0.987 });

    const tooltip = screen.getByTestId('graph-asset-tooltip');
    expect(tooltip).toHaveTextContent(substation.name);
    expect(tooltip).toHaveTextContent('Substation · Coast');
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('Loading92.0 %');
    expect(tooltip).toHaveTextContent('Voltage0.987 pu');
    expect(tooltip).toHaveTextContent(`${substation.capacityMw.toLocaleString('en')} MW`);
  });

  it("shows a line's study loading, without voltages, in what-if mode", () => {
    renderTooltip({ asset: line, status: 'alarm', loadingPct: 112.5, study: true });

    const tooltip = screen.getByTestId('graph-asset-tooltip');
    expect(tooltip).toHaveTextContent('Line ·');
    expect(tooltip).toHaveTextContent('Loading (study)112.5 %');
    expect(tooltip).not.toHaveTextContent('Voltage');
  });

  it('says when a line is tripped or a substation has no supply in the study', () => {
    renderTooltip({ asset: line, study: true, tripped: true, deEnergized: true });

    const tooltip = screen.getByTestId('graph-asset-tooltip');
    expect(tooltip).toHaveTextContent('Loading (study)Tripped');
    expect(tooltip).toHaveTextContent('No supply in this study');
  });
});
