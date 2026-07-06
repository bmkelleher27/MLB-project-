import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RawLiveFeed } from '../src/mlbApi.js';
import {
  buildPredictive,
  finalizeBatter,
  finalizePitcher,
  type BatterAcc,
  type PitcherAcc,
} from '../src/scorecard/predictive.js';

function loadFeed(name: string): RawLiveFeed {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as RawLiveFeed;
}

describe('finalizeBatter', () => {
  it('indexes DMG to 100 at league-average production per PA', () => {
    const acc: BatterAcc = {
      id: 1, name: 'x', pa: 4, strikeouts: 1, walks: 1, battedBalls: 2,
      barrels: 1, hardHit: 1, evSum: 376, evCount: 4, valueSum: 1.28, // 1.28/4 = 0.320 = league wOBA
    };
    const out = finalizeBatter(acc);
    expect(out.dmg).toBe(100);
    expect(out.avgEV).toBe(94); // 376/4
  });

  it('reports null avgEV when no batted ball was tracked', () => {
    const acc: BatterAcc = {
      id: 1, name: 'x', pa: 3, strikeouts: 3, walks: 0, battedBalls: 0,
      barrels: 0, hardHit: 0, evSum: 0, evCount: 0, valueSum: 0,
    };
    expect(finalizeBatter(acc).avgEV).toBeNull();
    expect(finalizeBatter(acc).dmg).toBe(0);
  });
});

describe('finalizePitcher', () => {
  it('indexes DOM to 100 at league-average CSW and contact', () => {
    const acc: PitcherAcc = {
      id: 1, name: 'p', pitches: 100, calledStrikes: 15, whiffs: 14, // CSW 0.29
      battedBallsAllowed: 10, hardHitAllowed: 3, evSum: 0, evCount: 0, conValueSum: 3.7, // xCon 0.37
    };
    const out = finalizePitcher(acc);
    expect(out.csw).toBe(0.29);
    expect(out.dom).toBe(100);
  });

  it('clamps DOM at 0 for a tiny, poor sample', () => {
    const acc: PitcherAcc = {
      id: 1, name: 'p', pitches: 5, calledStrikes: 0, whiffs: 0,
      battedBallsAllowed: 2, hardHitAllowed: 2, evSum: 0, evCount: 0, conValueSum: 1.0, // xCon 0.5
    };
    expect(finalizePitcher(acc).dom).toBe(0);
  });
});

describe('buildPredictive (integration)', () => {
  it('produces finite DMG/DOM for both teams of a modern game', () => {
    const { away, home } = buildPredictive(loadFeed('game-2024-final.json'));
    for (const side of [away, home]) {
      expect(side.batters.length).toBeGreaterThan(0);
      expect(side.pitchers.length).toBeGreaterThan(0);
      expect(side.batters.every((b) => Number.isFinite(b.dmg))).toBe(true);
      expect(side.pitchers.every((p) => Number.isFinite(p.dom))).toBe(true);
      // sorted best-first
      expect(side.batters).toEqual([...side.batters].sort((a, b) => b.dmg - a.dmg));
    }
    // Statcast era: at least some batters have a tracked exit velocity.
    expect(away.batters.some((b) => b.avgEV != null)).toBe(true);
  });

  it('degrades without Statcast: pre-2015 game has no exit velocity', () => {
    const { away, home } = buildPredictive(loadFeed('game-2010-final.json'));
    expect(away.batters.length).toBeGreaterThan(0);
    expect([...away.batters, ...home.batters].every((b) => b.avgEV === null)).toBe(true);
    // CSW-based DOM still works from pitch call codes.
    expect(away.pitchers.every((p) => Number.isFinite(p.dom))).toBe(true);
  });
});
