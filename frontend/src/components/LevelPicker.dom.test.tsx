// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LevelPicker } from './LevelPicker';

describe('LevelPicker', () => {
  it('offers every level by default, majors first', () => {
    render(<LevelPicker value={1} onChange={() => {}} />);
    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual(['MLB', 'AAA', 'AA', 'A+', 'A', 'ROK']);
  });

  it('marks the current level as pressed', () => {
    render(<LevelPicker value={11} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'AAA' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'MLB' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the chosen level', async () => {
    const onChange = vi.fn();
    render(<LevelPicker value={1} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'AA' }));
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('only offers the levels it is given, so a switch never leads nowhere', () => {
    render(<LevelPicker value={1} onChange={() => {}} available={[1, 11]} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['MLB', 'AAA']);
  });

  it('renders nothing when there is no real choice to make', () => {
    const { container } = render(<LevelPicker value={1} onChange={() => {}} available={[1]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes the full level name for the abbreviation', () => {
    render(<LevelPicker value={1} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'A+' })).toHaveAttribute('title', 'High-A');
  });
});
