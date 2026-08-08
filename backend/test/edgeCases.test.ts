import { describe, expect, it } from 'vitest';
import type { RawLiveFeed, RawPlay, RawRunner } from '../src/mlbApi.js';
import { TtlCache } from '../src/cache.js';
import { buildGameAtBats } from '../src/scorecard/atbats.js';
import { computeStuff } from '../src/scorecard/stuff.js';
import { transformLiveFeed } from '../src/scorecard/transform.js';

// ── Synthetic feed builders ─────────────────────────────────────────────
// Minimal Gumbo-shaped feeds so each edge case is hermetic (no fixtures).

const AWAY_IDS = [100, 101, 102, 103, 104, 105, 106, 107, 108];
const HOME_IDS = [200, 201, 202, 203, 204, 205, 206, 207, 208];

function player(id: number, slot: number, seq = 0) {
  return {
    person: { id, fullName: `Player ${id}` },
    position: { abbreviation: 'CF' },
    battingOrder: String(slot * 100 + seq),
  };
}

function boxTeam(teamId: number, name: string, ids: number[], extraPlayers: Record<string, unknown> = {}) {
  const players: Record<string, unknown> = { ...extraPlayers };
  ids.forEach((id, i) => {
    players[`ID${id}`] = player(id, i + 1);
  });
  return {
    team: { id: teamId, name, abbreviation: name.slice(0, 3).toUpperCase() },
    pitchers: [teamId * 10],
    players,
  };
}

function makeFeed(plays: RawPlay[], overrides: Partial<RawLiveFeed['gameData']['status']> = {}): RawLiveFeed {
  return {
    gamePk: 1,
    gameData: {
      status: { abstractGameState: 'Final', detailedState: 'Final', ...overrides },
      teams: { away: { abbreviation: 'AWY' }, home: { abbreviation: 'HOM' } },
    },
    liveData: {
      plays: { allPlays: plays },
      linescore: {
        innings: [
          {
            num: 1,
            away: { runs: 0, hits: 0, leftOnBase: 0, errors: 0 },
            home: { runs: 0, hits: 0, leftOnBase: 0, errors: 0 },
          },
        ],
        teams: { away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 } },
      },
      boxscore: {
        teams: {
          away: boxTeam(1, 'Away Club', AWAY_IDS) as RawLiveFeed['liveData']['boxscore']['teams']['away'],
          home: boxTeam(2, 'Home Club', HOME_IDS) as RawLiveFeed['liveData']['boxscore']['teams']['home'],
        },
      },
    },
  };
}

function runner(
  id: number,
  start: string | null,
  end: string | null,
  opts: { isOut?: boolean; outBase?: string; event?: string; credits?: RawRunner['credits'] } = {}
): RawRunner {
  return {
    movement: {
      start,
      end,
      outBase: opts.outBase ?? null,
      isOut: opts.isOut ?? false,
      outNumber: opts.isOut ? 1 : null,
    },
    details: {
      event: opts.event ?? null,
      eventType: null,
      runner: { id, fullName: `Player ${id}` },
      isScoringEvent: false,
      rbi: false,
    },
    credits: opts.credits ?? [],
  };
}

let nextAtBatIndex = 0;
function pa(opts: {
  batterId: number;
  event: string;
  eventType: string;
  runners: RawRunner[];
  inning?: number;
  half?: 'top' | 'bottom';
  rbi?: number;
  description?: string;
  playEvents?: RawPlay['playEvents'];
}): RawPlay {
  return {
    result: {
      type: 'atBat',
      event: opts.event,
      eventType: opts.eventType,
      description: opts.description ?? `${opts.event}.`,
      rbi: opts.rbi ?? 0,
      isOut: false,
    },
    about: {
      atBatIndex: nextAtBatIndex++,
      halfInning: opts.half ?? 'top',
      inning: opts.inning ?? 1,
      isComplete: true,
    },
    count: { balls: 1, strikes: 1, outs: 1 },
    matchup: {
      batter: { id: opts.batterId, fullName: `Player ${opts.batterId}` },
      pitcher: { id: 20, fullName: 'Pitcher 20' },
    },
    runners: opts.runners,
    playEvents: opts.playEvents ?? [
      { isPitch: true, pitchNumber: 1, count: { balls: 1, strikes: 1 }, details: { isStrike: true, description: 'Called Strike' } },
    ],
  };
}

function cellsOf(sc: ReturnType<typeof transformLiveFeed>, side: 'away' | 'home') {
  return Object.values(sc.teams[side].cellsBySlot).flat();
}

// ── The edge cases ──────────────────────────────────────────────────────

describe('edge cases — game states', () => {
  it('1. Preview game with no plays and no lineups produces an empty, valid scorecard', () => {
    const feed = makeFeed([], { abstractGameState: 'Preview', detailedState: 'Scheduled' });
    feed.liveData.boxscore.teams.away.players = {};
    feed.liveData.boxscore.teams.home.players = {};
    feed.liveData.linescore.innings = [];
    const sc = transformLiveFeed(feed);
    expect(sc.status.abstractGameState).toBe('Preview');
    expect(cellsOf(sc, 'away')).toHaveLength(0);
    expect(sc.linescore).toHaveLength(0);
  });

  it('2. linescore with missing runs/hits/lob fields yields zeros, never NaN', () => {
    const feed = makeFeed([]);
    feed.liveData.linescore.innings = [
      { num: 1, away: {}, home: {} } as unknown as RawLiveFeed['liveData']['linescore']['innings'][0],
    ];
    const sc = transformLiveFeed(feed);
    expect(sc.linescore[0].away).toEqual({ runs: 0, hits: 0, lob: 0 });
    expect(Number.isNaN(sc.linescore[0].home.runs)).toBe(false);
  });

  it('3. in-progress at-bat (isComplete false) is excluded until it resolves', () => {
    const play = pa({ batterId: 100, event: 'Single', eventType: 'single', runners: [runner(100, null, '1B')] });
    play.about.isComplete = false;
    const sc = transformLiveFeed(makeFeed([play]));
    expect(cellsOf(sc, 'away')).toHaveLength(0);
  });

  it('4. mid-at-bat baserunning play tagged atBat with no batter entry records nothing for the batter', () => {
    // e.g. runner caught stealing to end the inning before the PA concludes
    const play = pa({
      batterId: 101,
      event: 'Caught Stealing 2B',
      eventType: 'caught_stealing_2b',
      runners: [runner(100, '1B', null, { isOut: true, outBase: '2B', event: 'Caught Stealing 2B' })],
    });
    const sc = transformLiveFeed(makeFeed([play]));
    expect(cellsOf(sc, 'away')).toHaveLength(0); // no PA outcome for the batter
  });
});

describe('edge cases — batter outcomes', () => {
  it('5. dropped third strike: strikeout but batter reaches first', () => {
    const play = pa({
      batterId: 100,
      event: 'Strikeout',
      eventType: 'strikeout',
      description: 'Player 100 strikes out swinging, reaches first on a wild pitch.',
      runners: [runner(100, null, '1B')],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.code).toBe('K');
    expect(cell.isOut).toBe(false);
    expect(cell.basesReached).toBe('1B');
  });

  it('6. batter thrown out stretching a single shows the out at second on his own cell', () => {
    const play = pa({
      batterId: 100,
      event: 'Single',
      eventType: 'single',
      runners: [
        runner(100, null, '1B'),
        runner(100, '1B', null, {
          isOut: true,
          outBase: '2B',
          event: 'Single',
          credits: [
            { position: { code: '8', abbreviation: 'CF' }, credit: 'f_assist' },
            { position: { code: '6', abbreviation: 'SS' }, credit: 'f_putout' },
          ],
        }),
      ],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.basesReached).toBe('1B');
    expect(cell.advancement).toEqual([
      expect.objectContaining({ toBase: '2B', isOut: true, code: '8-6' }),
    ]);
  });

  it('7. catcher’s interference puts the batter on first with a CI code', () => {
    const play = pa({
      batterId: 100,
      event: 'Catcher Interference',
      eventType: 'catcher_interf',
      runners: [runner(100, null, '1B')],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.code).toBe('CI');
    expect(cell.basesReached).toBe('1B');
  });

  it('8. inside-the-park home run carries the fielded-ball position with the HR code', () => {
    const play = pa({
      batterId: 100,
      event: 'Home Run',
      eventType: 'home_run',
      rbi: 1,
      runners: [
        runner(100, null, 'score', {
          credits: [{ position: { code: '8', abbreviation: 'CF' }, credit: 'f_fielded_ball' }],
        }),
      ],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.code).toBe('HR-8');
    expect(cell.basesReached).toBe('HR');
  });

  it('9. grand slam records 4 RBI on the cell', () => {
    const play = pa({
      batterId: 103,
      event: 'Home Run',
      eventType: 'home_run',
      rbi: 4,
      runners: [runner(103, null, 'score')],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.rbi).toBe(4);
  });

  it('10. triple play builds the full fielding chain', () => {
    const play = pa({
      batterId: 102,
      event: 'Triple Play',
      eventType: 'triple_play',
      runners: [
        runner(100, '2B', null, {
          isOut: true,
          outBase: '3B',
          credits: [
            { position: { code: '5', abbreviation: '3B' }, credit: 'f_putout' },
          ],
        }),
        runner(101, '1B', null, {
          isOut: true,
          outBase: '2B',
          credits: [
            { position: { code: '5', abbreviation: '3B' }, credit: 'f_assist' },
            { position: { code: '4', abbreviation: '2B' }, credit: 'f_putout' },
          ],
        }),
        runner(102, null, null, {
          isOut: true,
          outBase: '1B',
          credits: [
            { position: { code: '4', abbreviation: '2B' }, credit: 'f_assist' },
            { position: { code: '3', abbreviation: '1B' }, credit: 'f_putout' },
          ],
        }),
      ],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.code).toBe('5-4-3');
    expect(cell.isOut).toBe(true);
  });

  it('11. an unrecognized future eventType falls back to the event name, never throws', () => {
    const play = pa({
      batterId: 100,
      event: 'Robot Ump Challenge Out',
      eventType: 'robot_ump_challenge_out',
      runners: [runner(100, null, null, { isOut: true, outBase: '1B' })],
    });
    const [cell] = cellsOf(transformLiveFeed(makeFeed([play])), 'away');
    expect(cell.code.length).toBeGreaterThan(0);
  });
});

describe('edge cases — baserunning', () => {
  function singleBy(batterId: number, extraRunners: RawRunner[] = [], overrides: Partial<Parameters<typeof pa>[0]> = {}): RawPlay {
    return pa({
      batterId,
      event: 'Single',
      eventType: 'single',
      runners: [runner(batterId, null, '1B'), ...extraRunners],
      ...overrides,
    });
  }

  it('12. straight steal of home scores the runner on his own cell with an SB label', () => {
    const first = singleBy(100);
    const steal = pa({
      batterId: 101,
      event: 'Stolen Base Home',
      eventType: 'stolen_base_home',
      runners: [runner(100, '3B', 'score', { event: 'Stolen Base Home' })],
    });
    // runner 100 must be moved to 3B before stealing home: give the steal play
    // a prior advance in the same feed via a wild pitch
    const wp = pa({
      batterId: 101,
      event: 'Wild Pitch',
      eventType: 'wild_pitch',
      runners: [runner(100, '1B', '3B', { event: 'Wild Pitch' })],
    });
    const sc = transformLiveFeed(makeFeed([first, wp, steal]));
    const cell = cellsOf(sc, 'away').find((c) => c.batterId === 100)!;
    const home = cell.advancement.find((a) => a.toBase === 'HOME');
    expect(home?.code).toBe('SB');
    expect(home?.isOut).toBe(false);
  });

  it('13. balk advances the runner with a BLK label', () => {
    const first = singleBy(100);
    const balk = pa({
      batterId: 101,
      event: 'Balk',
      eventType: 'balk',
      runners: [runner(100, '1B', '2B', { event: 'Balk' })],
    });
    const cell = cellsOf(transformLiveFeed(makeFeed([first, balk])), 'away').find((c) => c.batterId === 100)!;
    expect(cell.advancement).toEqual([expect.objectContaining({ toBase: '2B', code: 'BLK' })]);
  });

  it('14. one wild pitch advancing two runners annotates both originating cells', () => {
    const a = singleBy(100);
    const b = singleBy(101, [runner(100, '1B', '2B')]);
    const wp = pa({
      batterId: 102,
      event: 'Wild Pitch',
      eventType: 'wild_pitch',
      runners: [
        runner(100, '2B', '3B', { event: 'Wild Pitch' }),
        runner(101, '1B', '2B', { event: 'Wild Pitch' }),
      ],
    });
    const cells = cellsOf(transformLiveFeed(makeFeed([a, b, wp])), 'away');
    const c100 = cells.find((c) => c.batterId === 100)!;
    const c101 = cells.find((c) => c.batterId === 101)!;
    expect(c100.advancement.at(-1)).toEqual(expect.objectContaining({ toBase: '3B', code: 'WP' }));
    expect(c101.advancement.at(-1)).toEqual(expect.objectContaining({ toBase: '2B', code: 'WP' }));
  });

  it('15. extra-innings ghost runner (no originating PA) is tolerated without crashing', () => {
    // Runner 105 appears on 2B in the 10th with no cell that put him there.
    const ghostAdvance = pa({
      batterId: 100,
      event: 'Single',
      eventType: 'single',
      inning: 10,
      runners: [runner(100, null, '1B'), runner(105, '2B', 'score', { event: 'Single' })],
    });
    const sc = transformLiveFeed(makeFeed([ghostAdvance]));
    const cells = cellsOf(sc, 'away');
    expect(cells).toHaveLength(1); // the batter's cell only
    expect(cells[0].advancement).toHaveLength(0); // ghost movement lands nowhere
  });

  it('16. half-inning change clears the bases: a stale runner id in a later inning gets no advancement', () => {
    const top1 = singleBy(100);
    const bottom1 = pa({
      batterId: 200,
      event: 'Single',
      eventType: 'single',
      half: 'bottom',
      runners: [runner(200, null, '1B')],
    });
    // top 2: runner 100 (stranded in top 1) must NOT receive this movement
    const top2 = pa({
      batterId: 101,
      event: 'Single',
      eventType: 'single',
      inning: 2,
      runners: [runner(101, null, '1B'), runner(100, '1B', '2B')],
    });
    const sc = transformLiveFeed(makeFeed([top1, bottom1, top2]));
    const c100 = cellsOf(sc, 'away').find((c) => c.batterId === 100)!;
    expect(c100.advancement).toHaveLength(0);
  });
});

describe('edge cases — lineups and innings', () => {
  it('17. pinch hitter shares the lineup slot and his cell lands in that slot', () => {
    const feed = makeFeed([
      pa({ batterId: 100, event: 'Strikeout', eventType: 'strikeout', runners: [runner(100, null, null, { isOut: true, outBase: '1B' })] }),
      pa({ batterId: 999, event: 'Single', eventType: 'single', inning: 3, runners: [runner(999, null, '1B')] }),
    ]);
    feed.liveData.boxscore.teams.away.players['ID999'] = {
      person: { id: 999, fullName: 'Pinch Hitter' },
      position: { abbreviation: 'PH' },
      battingOrder: '101', // slot 1, second occupant
    };
    const sc = transformLiveFeed(feed);
    const slot1 = sc.teams.away.lineup.find((l) => l.slot === 1)!;
    expect(slot1.players.map((p) => p.id)).toEqual([100, 999]);
    expect(sc.teams.away.cellsBySlot[1].map((c) => c.batterId)).toEqual([100, 999]);
  });

  it('18. batting around: a slot batting twice in one inning keeps both cells in order', () => {
    const plays = [
      ...AWAY_IDS.map((id) => pa({ batterId: id, event: 'Single', eventType: 'single', runners: [runner(id, null, '1B')] })),
      pa({ batterId: 100, event: 'Double', eventType: 'double', runners: [runner(100, null, '2B')] }),
    ];
    const sc = transformLiveFeed(makeFeed(plays));
    const slot1 = sc.teams.away.cellsBySlot[1];
    expect(slot1).toHaveLength(2);
    expect(slot1.map((c) => c.code)).toEqual(['1B', '2B']);
    expect(slot1[0].atBatIndex).toBeLessThan(slot1[1].atBatIndex);
  });

  it('19. plays without pitches are excluded from the at-bats payload but pitched PAs survive', () => {
    const pitched = pa({ batterId: 100, event: 'Single', eventType: 'single', runners: [runner(100, null, '1B')] });
    const pitchless = pa({
      batterId: 101,
      event: 'Pickoff 1B',
      eventType: 'pickoff_1b',
      runners: [runner(100, '1B', null, { isOut: true, outBase: '1B', event: 'Pickoff 1B' })],
      playEvents: [{ isPitch: false, details: { description: 'Pickoff Attempt' } }],
    });
    const body = buildGameAtBats(makeFeed([pitched, pitchless]), 1);
    expect(body.atBats).toHaveLength(1);
    expect(body.atBats[0].pitches).toHaveLength(1);
    expect(body.status.abstractGameState).toBe('Final');
  });
});

describe('edge cases — computation bounds', () => {
  it('20a. Stuff+ clamps absurd inputs into [40, 175] and nulls un-gradeable pitches', () => {
    // 130 mph fastball with 30" of ride: elite but must clamp, not explode
    expect(computeStuff('FF', 130, 30, -20, 8)).toBeLessThanOrEqual(175);
    expect(computeStuff('FF', 40, -10, 0, 4)).toBeGreaterThanOrEqual(40);
    expect(computeStuff('FF', 95, null, null, null)).toBeNull(); // no movement data
    expect(computeStuff('PO', 88, 10, 5, 6)).toBeNull(); // pitchout: ungradeable type
    expect(computeStuff(null, 95, 15, -8, 6)).toBeNull();
  });

  it('20b. TtlCache under load: LRU eviction holds the cap and ttl<=0 is never stored', () => {
    const cache = new TtlCache<number>(100);
    for (let i = 0; i < 1_000; i++) cache.set(`k${i}`, i, 60_000);
    expect(cache.size).toBeLessThanOrEqual(100);
    expect(cache.get('k0')).toBeUndefined(); // long evicted
    expect(cache.get('k999')).toBe(999); // most recent survives
    cache.set('never', 1, 0);
    expect(cache.get('never')).toBeUndefined();
  });
});
