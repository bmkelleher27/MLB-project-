import { describe, expect, it } from 'vitest';
import {
  ALL_ZONES,
  buildArsenal,
  buildSplits,
  buildTrend,
  buildZones,
  hasProfileData,
  parseStatValue,
} from '../src/player/profile.js';

describe('parseStatValue', () => {
  it('parses leading-dot rate stats', () => {
    expect(parseStatValue('.333')).toBeCloseTo(0.333);
  });

  it('parses values above one and plain numbers', () => {
    expect(parseStatValue('1.250')).toBeCloseTo(1.25);
    expect(parseStatValue('91.99')).toBeCloseTo(91.99);
    expect(parseStatValue(42)).toBe(42);
  });

  it('returns null for the API’s empty placeholders', () => {
    expect(parseStatValue('')).toBeNull();
    expect(parseStatValue('-')).toBeNull();
    expect(parseStatValue('.---')).toBeNull();
    expect(parseStatValue(undefined)).toBeNull();
  });
});

describe('buildArsenal', () => {
  const raw = {
    stats: [
      {
        splits: [
          { stat: { percentage: 0.15, count: 150, averageSpeed: 84.8031, type: { code: 'CH', description: 'Changeup' } } },
          { stat: { percentage: 0.47, count: 470, averageSpeed: 95.111, type: { code: 'FF', description: 'Four-seam FB' } } },
        ],
      },
    ],
  };

  it('sorts most-used first so the shape of the mix reads immediately', () => {
    expect(buildArsenal(raw).map((a) => a.code)).toEqual(['FF', 'CH']);
  });

  it('rounds average speed to a tenth of a mph', () => {
    expect(buildArsenal(raw)[0].avgSpeed).toBe(95.1);
  });

  it('skips entries with no pitch type rather than inventing one', () => {
    const partial = { stats: [{ splits: [{ stat: { percentage: 1, count: 5 } }] }] };
    expect(buildArsenal(partial)).toEqual([]);
  });

  it('returns an empty arsenal for an empty payload', () => {
    expect(buildArsenal({})).toEqual([]);
  });
});

describe('buildZones', () => {
  const zones = (values: Record<string, string>) =>
    Object.entries(values).map(([zone, value]) => ({ zone, value }));

  it('always emits all 13 zones, filling gaps with nulls', () => {
    const raw = { stats: [{ splits: [{ stat: { name: 'battingAverage', zones: zones({ '01': '.300' }) } }] }] };
    const [metric] = buildZones(raw);
    expect(metric.cells).toHaveLength(13);
    expect(metric.cells.map((c) => c.zone)).toEqual(ALL_ZONES);
    expect(metric.cells.find((c) => c.zone === '02')?.value).toBeNull();
  });

  it('averages performance metrics for the diverging midpoint', () => {
    const raw = {
      stats: [{ splits: [{ stat: { name: 'battingAverage', zones: zones({ '01': '.200', '02': '.400' }) } }] }],
    };
    expect(buildZones(raw)[0].reference).toBeCloseTo(0.3);
  });

  it('totals volume metrics instead of averaging them', () => {
    const raw = {
      stats: [{ splits: [{ stat: { name: 'numberOfPitches', zones: zones({ '01': '10', '02': '30' }) } }] }],
    };
    const [metric] = buildZones(raw);
    expect(metric.kind).toBe('volume');
    expect(metric.reference).toBe(40);
  });

  it('puts pitch location ahead of rate stats in the metric order', () => {
    const raw = {
      stats: [
        {
          splits: [
            { stat: { name: 'onBasePlusSlugging', zones: zones({ '01': '.900' }) } },
            { stat: { name: 'numberOfPitches', zones: zones({ '01': '12' }) } },
          ],
        },
      ],
    };
    expect(buildZones(raw).map((z) => z.label)).toEqual(['Pitches', 'OPS']);
  });

  it('drops metrics it cannot label honestly', () => {
    const raw = { stats: [{ splits: [{ stat: { name: 'someUnknownMetric', zones: zones({ '01': '1' }) } }] }] };
    expect(buildZones(raw)).toEqual([]);
  });
});

describe('buildSplits', () => {
  it('reads plate appearances for hitters', () => {
    const raw = { stats: [{ splits: [{ split: { code: 'vl' }, stat: { plateAppearances: 76, ops: '.947' } }] }] };
    const [line] = buildSplits(raw, 'hitting');
    expect(line.label).toBe('vs LHP');
    expect(line.plateAppearances).toBe(76);
  });

  it('falls back to batters faced for pitchers, and labels them as hitters', () => {
    const raw = { stats: [{ splits: [{ split: { code: 'vl' }, stat: { battersFaced: 195, ops: '.654' } }] }] };
    const [line] = buildSplits(raw, 'pitching');
    expect(line.label).toBe('vs LHB');
    expect(line.plateAppearances).toBe(195);
  });
});

describe('buildTrend', () => {
  const raw = {
    stats: [
      {
        splits: [
          { month: 5, stat: { gamesPlayed: 28, ops: '.805', avg: '.243', plateAppearances: 100, strikeOuts: 35, baseOnBalls: 10 } },
          { month: 3, stat: { gamesPlayed: 5, ops: '.640', avg: '.150', plateAppearances: 20, strikeOuts: 10, baseOnBalls: 2 } },
        ],
      },
    ],
  };

  it('sorts months chronologically, however the API returned them', () => {
    expect(buildTrend(raw, 'hitting').map((t) => t.label)).toEqual(['Mar', 'May']);
  });

  it('computes rate stats against plate appearances for hitters', () => {
    const may = buildTrend(raw, 'hitting').find((t) => t.month === 5)!;
    expect(may.strikeoutRate).toBeCloseTo(0.35);
    expect(may.walkRate).toBeCloseTo(0.1);
    expect(may.primary).toBeCloseTo(0.805);
  });

  it('uses ERA as the primary measure and batters faced as the denominator for pitchers', () => {
    const pitchRaw = {
      stats: [{ splits: [{ month: 4, stat: { gamesPlayed: 6, era: '3.42', avg: '.203', battersFaced: 200, strikeOuts: 50, baseOnBalls: 10 } }] }],
    };
    const [pt] = buildTrend(pitchRaw, 'pitching');
    expect(pt.primary).toBeCloseTo(3.42);
    expect(pt.strikeoutRate).toBeCloseTo(0.25);
  });

  it('leaves rates null rather than dividing by zero', () => {
    const empty = { stats: [{ splits: [{ month: 4, stat: { gamesPlayed: 1 } }] }] };
    expect(buildTrend(empty, 'hitting')[0].strikeoutRate).toBeNull();
  });
});

describe('hasProfileData', () => {
  it('is false only when every section is empty', () => {
    expect(hasProfileData({ arsenal: [], zones: [], splits: [], trend: [] })).toBe(false);
    expect(
      hasProfileData({
        arsenal: [{ code: 'FF', name: 'Four-seam FB', count: 1, share: 1, avgSpeed: 95 }],
        zones: [],
        splits: [],
        trend: [],
      })
    ).toBe(true);
  });
});
