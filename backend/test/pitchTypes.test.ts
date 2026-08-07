import { describe, expect, it } from 'vitest';
import type { RawPitchLog } from '../src/mlbApi.js';
import { MIN_AT_BATS, buildPitchTypePerformance } from '../src/player/pitchTypes.js';

/** Builds a playLog/pitchLog envelope from bare pitch detail objects. */
function log(entries: Array<Record<string, unknown>>): RawPitchLog {
  return {
    stats: [
      {
        splits: entries.map((details) => ({ stat: { play: { details } } })),
      },
    ],
  } as RawPitchLog;
}

const type = (code: string) => ({ code, description: code });

/** n plate appearances of one event against one pitch type. */
function pa(n: number, code: string, extra: Record<string, unknown>) {
  return Array.from({ length: n }, () => ({
    type: type(code),
    isPlateAppearance: true,
    isAtBat: true,
    ...extra,
  }));
}

describe('buildPitchTypePerformance — rate stats', () => {
  it('computes AVG and SLG from plate-appearance outcomes', () => {
    const playLog = log([
      ...pa(4, 'FF', { isBaseHit: true, eventType: 'single' }),
      ...pa(2, 'FF', { isBaseHit: true, eventType: 'home_run' }),
      ...pa(6, 'FF', { eventType: 'field_out' }),
    ]);
    const ff = buildPitchTypePerformance(playLog, log([])).get('FF')!;
    expect(ff.atBats).toBe(12);
    expect(ff.hits).toBe(6);
    // 4 singles + 2 home runs = 4 + 8 = 12 total bases
    expect(ff.totalBases).toBe(12);
    expect(ff.avg).toBeCloseTo(0.5);
    expect(ff.slg).toBeCloseTo(1.0);
  });

  it('excludes walks from at-bats but counts them as plate appearances', () => {
    const playLog = log([
      ...pa(10, 'SL', { eventType: 'field_out' }),
      { type: type('SL'), isPlateAppearance: true, isAtBat: false, eventType: 'walk' },
    ]);
    const sl = buildPitchTypePerformance(playLog, log([])).get('SL')!;
    expect(sl.atBats).toBe(10);
    expect(sl.plateAppearances).toBe(11);
    expect(sl.avg).toBeCloseTo(0);
  });

  it('tracks strikeout rate against plate appearances', () => {
    const playLog = log([
      ...pa(5, 'CH', { eventType: 'strikeout' }),
      ...pa(5, 'CH', { eventType: 'field_out' }),
    ]);
    const ch = buildPitchTypePerformance(playLog, log([])).get('CH')!;
    expect(ch.strikeouts).toBe(5);
    expect(ch.strikeoutRate).toBeCloseTo(0.5);
  });
});

describe('buildPitchTypePerformance — swings and whiffs', () => {
  const pitches = (n: number, code: string, call: string, extra: Record<string, unknown> = {}) =>
    Array.from({ length: n }, () => ({ type: type(code), call: { code: call }, ...extra }));

  it('counts a swinging strikeout as both a swing and a whiff', () => {
    // The pitch that ends a strikeout is eventType "strikeout" — only the call
    // code reveals the batter swung. Missing this undercounts whiffs badly.
    const pitchLog = log([
      ...pitches(9, 'SL', 'S'),
      { type: type('SL'), call: { code: 'S' }, eventType: 'strikeout' },
    ]);
    const sl = buildPitchTypePerformance(log([]), pitchLog).get('SL')!;
    expect(sl.swings).toBe(10);
    expect(sl.whiffs).toBe(10);
    expect(sl.whiffRate).toBeCloseTo(1);
  });

  it('treats a called strikeout as neither a swing nor a whiff', () => {
    const pitchLog = log([
      ...pitches(10, 'CU', 'S'),
      { type: type('CU'), call: { code: 'C' }, eventType: 'strikeout' },
    ]);
    const cu = buildPitchTypePerformance(log([]), pitchLog).get('CU')!;
    expect(cu.swings).toBe(10);
    expect(cu.whiffs).toBe(10);
  });

  it('counts fouls and balls in play as swings that made contact', () => {
    const pitchLog = log([
      ...pitches(4, 'FF', 'F'), // foul
      ...pitches(3, 'FF', 'X'), // in play, out
      ...pitches(2, 'FF', 'T'), // foul tip — contact, not a whiff
      ...pitches(3, 'FF', 'S'), // swinging strike
    ]);
    const ff = buildPitchTypePerformance(log([]), pitchLog).get('FF')!;
    expect(ff.swings).toBe(12);
    expect(ff.whiffs).toBe(3);
    expect(ff.whiffRate).toBeCloseTo(0.25);
  });

  it('does not count called strikes or balls as swings', () => {
    const pitchLog = log([...pitches(10, 'SI', 'B'), ...pitches(5, 'SI', 'C')]);
    const si = buildPitchTypePerformance(log([]), pitchLog).get('SI')!;
    expect(si.swings).toBe(0);
    expect(si.whiffs).toBe(0);
    // No swings means no denominator, so the rate is withheld rather than 0/0.
    expect(si.whiffRate).toBeNull();
  });

  it('falls back to isInPlay for an unrecognised in-play call code', () => {
    const pitchLog = log([
      ...pitches(10, 'FC', 'S'),
      { type: type('FC'), call: { code: 'ZZ' }, isInPlay: true },
    ]);
    const fc = buildPitchTypePerformance(log([]), pitchLog).get('FC')!;
    expect(fc.swings).toBe(11);
    expect(fc.whiffs).toBe(10);
  });
});

describe('buildPitchTypePerformance — guards', () => {
  it('withholds rate stats below the at-bat threshold but keeps the counts', () => {
    const playLog = log(pa(3, 'KC', { isBaseHit: true, eventType: 'single' }));
    const kc = buildPitchTypePerformance(playLog, log([])).get('KC')!;
    expect(kc.atBats).toBe(3);
    expect(kc.hits).toBe(3);
    expect(kc.lowSample).toBe(true);
    expect(kc.avg).toBeNull();
    expect(kc.slg).toBeNull();
  });

  it('reports rates once the threshold is met', () => {
    const playLog = log(pa(MIN_AT_BATS, 'KC', { isBaseHit: true, eventType: 'single' }));
    const kc = buildPitchTypePerformance(playLog, log([])).get('KC')!;
    expect(kc.lowSample).toBe(false);
    expect(kc.avg).toBeCloseTo(1);
  });

  it('ignores pitches with no classified type rather than pooling them', () => {
    const playLog = log([
      { isPlateAppearance: true, isAtBat: true, eventType: 'field_out' },
      ...pa(1, 'FF', { eventType: 'field_out' }),
    ]);
    const result = buildPitchTypePerformance(playLog, log([]));
    expect([...result.keys()]).toEqual(['FF']);
  });

  it('returns an empty map for empty logs', () => {
    expect(buildPitchTypePerformance(log([]), log([])).size).toBe(0);
    expect(buildPitchTypePerformance({}, {}).size).toBe(0);
  });
});
