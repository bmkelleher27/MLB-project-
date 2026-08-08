// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ZoneMetric } from '@mlb-scorecards/shared';
import { ZoneChart } from './ZoneChart';

const ALL_ZONES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '11', '12', '13', '14'];

function metric(over: Partial<ZoneMetric> = {}): ZoneMetric {
  return {
    name: 'onBasePlusSlugging',
    label: 'OPS',
    description: 'On-base plus slugging by zone',
    kind: 'performance',
    reference: 0.8,
    cells: ALL_ZONES.map((zone, i) => ({
      zone,
      value: 0.4 + i * 0.1,
      display: String(0.4 + i * 0.1),
    })),
    ...over,
  };
}

describe('ZoneChart', () => {
  it('draws all thirteen zones of the Gameday grid', () => {
    const { container } = render(<ZoneChart metric={metric()} caption="Damage by zone" />);
    expect(container.querySelectorAll('.zone-rect')).toHaveLength(13);
  });

  it('uses the diverging scale for performance and the sequential scale for volume', () => {
    const { container: perf } = render(<ZoneChart metric={metric()} caption="c" />);
    expect(perf.querySelector('.zone-plot')).toHaveClass('zone-div');

    const { container: vol } = render(
      <ZoneChart
        metric={metric({ name: 'numberOfPitches', label: 'Pitches', kind: 'volume', reference: 900 })}
        caption="c"
      />
    );
    expect(vol.querySelector('.zone-plot')).toHaveClass('zone-seq');
  });

  it('renders a cell with no data without inventing a value', () => {
    const withGap = metric();
    withGap.cells[4] = { zone: '05', value: null, display: '' };
    const { container } = render(<ZoneChart metric={withGap} caption="c" />);
    expect(container.querySelectorAll('.zone-rect-empty')).toHaveLength(1);
    // The dash appears in the grid and again in the table twin.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('labels the legend by scale type', () => {
    render(<ZoneChart metric={metric()} caption="c" />);
    expect(screen.getByText('Below avg')).toBeInTheDocument();
    expect(screen.getByText('Above avg')).toBeInTheDocument();

    render(<ZoneChart metric={metric({ kind: 'volume', name: 'numberOfPitches' })} caption="c" />);
    expect(screen.getByText('Fewest')).toBeInTheDocument();
    expect(screen.getByText('Most')).toBeInTheDocument();
  });

  it('states the diverging midpoint so "hot" is interpretable', () => {
    render(<ZoneChart metric={metric()} caption="c" />);
    expect(screen.getByText(/own zone average/)).toBeInTheDocument();
  });

  it('offers a table twin naming every zone location', () => {
    render(<ZoneChart metric={metric()} caption="c" />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Middle middle')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(14); // 13 zones + header
  });

  it('carries an accessible description pointing at the table', () => {
    render(<ZoneChart metric={metric()} caption="Damage by zone" />);
    expect(screen.getByRole('img', { name: /Damage by zone/ })).toHaveAccessibleName(
      /listed in the table below/
    );
  });
});
