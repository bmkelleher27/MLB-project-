import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Cell } from '@mlb-scorecards/shared';
import type { RawLiveFeed } from '../src/mlbApi.js';
import { transformLiveFeed } from '../src/scorecard/transform.js';

function loadFeed(name: string): RawLiveFeed {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as RawLiveFeed;
}

function allCells(sc: ReturnType<typeof transformLiveFeed>): Cell[] {
  return (['away', 'home'] as const).flatMap((side) =>
    Object.values(sc.teams[side].cellsBySlot).flat()
  );
}

describe('transformLiveFeed — modern game (2024, Statcast)', () => {
  const sc = transformLiveFeed(loadFeed('game-2024-final.json'));

  it('reports a Final game with the official date and team abbreviations', () => {
    expect(sc.status.abstractGameState).toBe('Final');
    expect(sc.date).toBe('2024-06-15');
    expect(sc.teams.away.team.abbreviation).toBe('STL');
    expect(sc.teams.home.team.abbreviation).toBe('CHC');
  });

  it('keeps summed inning runs and hits consistent with team totals', () => {
    const awayRuns = sc.linescore.reduce((s, l) => s + l.away.runs, 0);
    const homeRuns = sc.linescore.reduce((s, l) => s + l.home.runs, 0);
    const awayHits = sc.linescore.reduce((s, l) => s + l.away.hits, 0);
    const homeHits = sc.linescore.reduce((s, l) => s + l.home.hits, 0);
    expect(awayRuns).toBe(sc.totals.away.r);
    expect(homeRuns).toBe(sc.totals.home.r);
    expect(awayHits).toBe(sc.totals.away.h);
    expect(homeHits).toBe(sc.totals.home.h);
  });

  it('gives every plate-appearance cell a non-empty code', () => {
    const cells = allCells(sc);
    expect(cells.length).toBeGreaterThan(30);
    expect(cells.every((c) => typeof c.code === 'string' && c.code.length > 0)).toBe(true);
  });

  it('records recognizable outcomes (a home run and a strikeout)', () => {
    const codes = allCells(sc).map((c) => c.code);
    expect(codes).toContain('HR');
    expect(codes.some((c) => c === 'K' || c === 'ꓘ')).toBe(true);
  });

  it('attaches Statcast exit velocity to home-run cells', () => {
    const hr = allCells(sc).find((c) => c.basesReached === 'HR');
    expect(hr).toBeDefined();
    expect(typeof hr!.exitVelocity).toBe('number');
  });

  it('includes predictive metrics and per-pitcher Stuff', () => {
    expect(sc.predictive.away.batters.length).toBeGreaterThan(0);
    expect(sc.predictive.home.pitchers.length).toBeGreaterThan(0);
    const pitchers = [...sc.teams.away.pitching, ...sc.teams.home.pitching];
    expect(pitchers.some((p) => typeof p.stuff === 'number')).toBe(true);
  });
});

describe('transformLiveFeed — pre-Statcast game (2010)', () => {
  const sc = transformLiveFeed(loadFeed('game-2010-final.json'));

  it('parses the date and still builds a full scorecard', () => {
    expect(sc.date?.startsWith('2010-')).toBe(true);
    expect(allCells(sc).every((c) => c.code.length > 0)).toBe(true);
  });

  it('has no Statcast fields (exit velocity, Stuff) but keeps the box score', () => {
    expect(allCells(sc).every((c) => c.exitVelocity === undefined)).toBe(true);
    const pitchers = [...sc.teams.away.pitching, ...sc.teams.home.pitching];
    expect(pitchers.every((p) => p.stuff === null)).toBe(true);
    // Runs still reconcile.
    const awayRuns = sc.linescore.reduce((s, l) => s + l.away.runs, 0);
    expect(awayRuns).toBe(sc.totals.away.r);
  });
});
