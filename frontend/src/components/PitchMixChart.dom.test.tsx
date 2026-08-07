// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PitchTypeUsage } from '@mlb-scorecards/shared';
import { PitchMixChart } from './PitchMixChart';

function usage(over: Partial<PitchTypeUsage> = {}): PitchTypeUsage {
  return {
    code: 'FF',
    name: 'Four-seam FB',
    count: 276,
    share: 0.248,
    avgSpeed: 95.2,
    performance: {
      plateAppearances: 53,
      atBats: 42,
      hits: 9,
      totalBases: 23,
      strikeouts: 17,
      swings: 115,
      whiffs: 27,
      avg: 0.214,
      slg: 0.548,
      strikeoutRate: 0.321,
      whiffRate: 0.235,
      lowSample: false,
    },
    ...over,
  };
}

const props = { caption: 'What he saw', subtitle: 'Pitches thrown to him', isBatting: true };

describe('PitchMixChart', () => {
  it('renders nothing when the arsenal is empty', () => {
    const { container } = render(<PitchMixChart arsenal={[]} {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('prints usage, velocity and performance for each pitch type', () => {
    render(<PitchMixChart arsenal={[usage()]} {...props} />);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Four-seam FB')).toBeInTheDocument();
    expect(within(row).getByText('24.8%')).toBeInTheDocument();
    expect(within(row).getByText('95.2 mph')).toBeInTheDocument();
    // Rate stats print scorebook-style, without the leading zero.
    expect(within(row).getByText('.214')).toBeInTheDocument();
    expect(within(row).getByText('.548')).toBeInTheDocument();
    expect(within(row).getByText('24%')).toBeInTheDocument();
  });

  it('keeps the leading digit once a rate exceeds 1.000', () => {
    const slugger = usage({ performance: { ...usage().performance!, slg: 1.125 } });
    render(<PitchMixChart arsenal={[slugger]} {...props} />);
    // Present in both the compact row and its table twin, by design.
    expect(within(screen.getByRole('listitem')).getByText('1.125')).toBeInTheDocument();
  });

  it('withholds rates for a low-sample pitch type but still shows it', () => {
    const rare = usage({
      code: 'KC',
      name: 'Knuckle Curve',
      count: 6,
      share: 0.005,
      performance: {
        plateAppearances: 3, atBats: 3, hits: 2, totalBases: 2, strikeouts: 0,
        swings: 4, whiffs: 0, avg: null, slg: null, strikeoutRate: null,
        whiffRate: null, lowSample: true,
      },
    });
    render(<PitchMixChart arsenal={[rare]} {...props} />);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Knuckle Curve')).toBeInTheDocument();
    // A dash, never a misleading .667 off three at-bats.
    expect(screen.queryByText('.667')).not.toBeInTheDocument();
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('scales bars against the most-used pitch, not the full width', () => {
    const { container } = render(
      <PitchMixChart arsenal={[usage({ share: 0.5 }), usage({ code: 'SL', share: 0.25 })]} {...props} />
    );
    const bars = container.querySelectorAll<HTMLElement>('.mix-bar');
    expect(bars[0].style.width).toBe('100%');
    expect(bars[1].style.width).toBe('50%');
  });

  it('omits the performance columns entirely when no pitch has results', () => {
    render(<PitchMixChart arsenal={[usage({ performance: null })]} {...props} />);
    expect(screen.queryByText('AVG')).not.toBeInTheDocument();
    expect(screen.queryByText('Whiff')).not.toBeInTheDocument();
    // …and the usage information still renders.
    expect(screen.getByText('Four-seam FB')).toBeInTheDocument();
  });

  it('provides a table view so hidden columns stay reachable without hover', () => {
    render(<PitchMixChart arsenal={[usage()]} {...props} />);
    expect(screen.getByText('View as table')).toBeInTheDocument();
    // The table exposes the raw counts the compact row omits.
    const table = screen.getByRole('table');
    expect(within(table).getByText('Swings')).toBeInTheDocument();
    expect(within(table).getByText('115')).toBeInTheDocument();
  });

  it('describes the attribution rule so the two denominators are not confused', () => {
    render(<PitchMixChart arsenal={[usage()]} {...props} />);
    expect(screen.getByText(/ended/)).toBeInTheDocument();
    expect(screen.getByText(/different\s+denominators/)).toBeInTheDocument();
  });
});
