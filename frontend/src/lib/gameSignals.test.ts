import { describe, expect, it } from 'vitest';
import type { ScheduleGame } from '@mlb-scorecards/shared';
import { drama, dramaReason, gameBadges, isWalkOff } from './gameSignals';

/** Minimal ScheduleGame builder — only the fields the signal functions read. */
function game(overrides: Partial<ScheduleGame> = {}): ScheduleGame {
  return {
    gamePk: 1,
    gameDate: '2026-07-26T18:00:00Z',
    status: { abstractGameState: 'Live', detailedState: 'In Progress' },
    inning: 5,
    inningState: 'Top',
    away: { id: 100, name: 'Aways', abbreviation: 'AWY', score: 2, probablePitcher: null },
    home: { id: 200, name: 'Homes', abbreviation: 'HOM', score: 2, probablePitcher: null },
    venue: 'Test Park',
    linescore: null,
    hits: null,
    situation: null,
    ...overrides,
  };
}

describe('isWalkOff', () => {
  it('flags a home win where the final-frame runs erased the deficit', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 3 },
      home: { ...game().home, score: 4 },
      linescore: [{ num: 9, away: 0, home: 2 }],
    });
    expect(isWalkOff(g)).toBe(true);
  });

  it('is false for a home win decided before the final frame (blowout)', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 2 },
      home: { ...game().home, score: 10 },
      linescore: [{ num: 9, away: 0, home: 1 }],
    });
    expect(isWalkOff(g)).toBe(false);
  });

  it('is false when the home team lost', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 5 },
      home: { ...game().home, score: 2 },
      linescore: [{ num: 9, away: 1, home: 0 }],
    });
    expect(isWalkOff(g)).toBe(false);
  });

  it('is false when the home team did not score in the final frame', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 1 },
      home: { ...game().home, score: 3 },
      linescore: [{ num: 9, away: 1, home: 0 }],
    });
    expect(isWalkOff(g)).toBe(false);
  });
});

describe('gameBadges', () => {
  it('surfaces a live no-hitter from the 6th on, without spoiling', () => {
    const g = game({ inning: 7, hits: { away: 0, home: 5 } });
    const nono = gameBadges(g).find((b) => b.key === 'nono');
    expect(nono).toBeDefined();
    expect(nono?.spoils).toBe(false);
  });

  it('marks a one-run game late as close', () => {
    const g = game({
      inning: 8,
      away: { ...game().away, score: 2 },
      home: { ...game().home, score: 1 },
    });
    expect(gameBadges(g).some((b) => b.key === 'closelate')).toBe(true);
  });

  it('marks a live game in extras', () => {
    const g = game({ inning: 10 });
    const keys = gameBadges(g).map((b) => b.key);
    expect(keys).toContain('extras');
    expect(keys).not.toContain('closelate');
  });

  it('flags a final walk-off as a spoiler', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 3 },
      home: { ...game().home, score: 4 },
      linescore: [{ num: 9, away: 0, home: 2 }],
    });
    const walkoff = gameBadges(g).find((b) => b.key === 'walkoff');
    expect(walkoff).toBeDefined();
    expect(walkoff?.spoils).toBe(true);
  });

  it('labels a final that went to extra innings', () => {
    const g = game({
      status: { abstractGameState: 'Final', detailedState: 'Final' },
      away: { ...game().away, score: 5 },
      home: { ...game().home, score: 4 },
      linescore: Array.from({ length: 11 }, (_, i) => ({ num: i + 1, away: 0, home: 0 })),
    });
    expect(gameBadges(g).some((b) => b.label === 'F/11')).toBe(true);
  });

  it('returns no badges for a routine mid-game', () => {
    const g = game({ inning: 4, away: { ...game().away, score: 5 }, home: { ...game().home, score: 1 } });
    expect(gameBadges(g)).toHaveLength(0);
  });
});

describe('drama', () => {
  it('returns -1 for a game that is not live', () => {
    expect(drama(game({ status: { abstractGameState: 'Final', detailedState: 'Final' } }))).toBe(-1);
  });

  it('ranks a close late game above a late blowout', () => {
    const close = game({ inning: 8, away: { ...game().away, score: 3 }, home: { ...game().home, score: 3 } });
    const blowout = game({ inning: 8, away: { ...game().away, score: 10 }, home: { ...game().home, score: 1 } });
    expect(drama(close)).toBeGreaterThan(drama(blowout));
  });

  it('boosts a live no-hitter', () => {
    const plain = game({ inning: 7, hits: { away: 5, home: 4 } });
    const nono = game({ inning: 7, hits: { away: 0, home: 4 } });
    expect(drama(nono)).toBeGreaterThan(drama(plain));
  });
});

describe('dramaReason', () => {
  it('returns null when the game is not live', () => {
    expect(dramaReason(game({ status: { abstractGameState: 'Preview', detailedState: 'Scheduled' } }))).toBeNull();
  });

  it('calls out a no-hitter in progress', () => {
    const g = game({ inning: 7, inningState: 'Top', hits: { away: 4, home: 0 } });
    expect(dramaReason(g)).toMatch(/no-hitter/i);
  });

  it('describes a tie late', () => {
    const g = game({ inning: 8, away: { ...game().away, score: 2 }, home: { ...game().home, score: 2 } });
    expect(dramaReason(g)).toMatch(/tied/i);
  });
});
