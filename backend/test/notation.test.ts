import { describe, expect, it } from 'vitest';
import type { RawPlay, RawRunner, RawRunnerCredit } from '../src/mlbApi.js';
import {
  buildBatterCode,
  buildRunnerAdvancementCode,
  combinedOutChain,
  creditChain,
} from '../src/scorecard/notation.js';

function credit(abbr: string, creditType: string): RawRunnerCredit {
  return { position: { code: '', abbreviation: abbr }, credit: creditType };
}

function runner(opts: {
  isOut?: boolean;
  outNumber?: number | null;
  end?: string | null;
  event?: string | null;
  credits?: RawRunnerCredit[];
  id?: number;
}): RawRunner {
  return {
    movement: {
      start: null,
      end: opts.end ?? null,
      outBase: null,
      isOut: opts.isOut ?? false,
      outNumber: opts.outNumber ?? null,
    },
    details: {
      event: opts.event ?? null,
      eventType: null,
      runner: { id: opts.id ?? 1, fullName: 'Runner' },
      isScoringEvent: false,
      rbi: false,
    },
    credits: opts.credits ?? [],
  };
}

function play(result: { event: string; eventType: string; description?: string }, runners: RawRunner[] = []): RawPlay {
  return {
    result: {
      type: 'atBat',
      event: result.event,
      eventType: result.eventType,
      description: result.description ?? '',
      rbi: 0,
      isOut: false,
    },
    about: { atBatIndex: 0, halfInning: 'top', inning: 1, isComplete: true },
    count: { balls: 0, strikes: 0, outs: 0 },
    matchup: { batter: { id: 1, fullName: 'B' }, pitcher: { id: 2, fullName: 'P' } },
    runners,
  };
}

describe('creditChain / combinedOutChain', () => {
  it('maps assist→putout to fielder numbers', () => {
    expect(creditChain([credit('SS', 'f_assist'), credit('1B', 'f_putout')])).toEqual([6, 3]);
  });

  it('ignores non-fielding credits', () => {
    expect(creditChain([credit('SS', 'f_fielded_ball'), credit('CF', 'f_putout')])).toEqual([8]);
  });

  it('builds a 6-4-3 double-play chain', () => {
    const lead = runner({ isOut: true, credits: [credit('SS', 'f_assist'), credit('2B', 'f_putout')] });
    const batter = runner({ isOut: true, credits: [credit('2B', 'f_assist'), credit('1B', 'f_putout')] });
    expect(combinedOutChain([lead, batter])).toEqual([6, 4, 3]);
  });
});

describe('buildBatterCode', () => {
  it('distinguishes swinging vs called strikeouts', () => {
    expect(buildBatterCode(play({ event: 'Strikeout', eventType: 'strikeout', description: 'strikes out swinging.' }), undefined).code).toBe('K');
    expect(buildBatterCode(play({ event: 'Strikeout', eventType: 'strikeout', description: 'called out on strikes.' }), undefined).code).toBe('ꓘ');
  });

  it('codes walks, IBB, HBP, and interference', () => {
    expect(buildBatterCode(play({ event: 'Walk', eventType: 'walk' }), undefined).code).toBe('BB');
    expect(buildBatterCode(play({ event: 'Intent Walk', eventType: 'intent_walk' }), undefined).code).toBe('IBB');
    expect(buildBatterCode(play({ event: 'Hit By Pitch', eventType: 'hit_by_pitch' }), undefined).code).toBe('HBP');
    expect(buildBatterCode(play({ event: 'Catcher Interference', eventType: 'catcher_interf' }), undefined).code).toBe('CI');
  });

  it('codes hits with an optional fielder suffix', () => {
    expect(buildBatterCode(play({ event: 'Single', eventType: 'single' }), runner({})).code).toBe('1B');
    expect(buildBatterCode(play({ event: 'Single', eventType: 'single' }), runner({ credits: [credit('SS', 'f_fielded_ball')] })).code).toBe('1B-6');
    expect(buildBatterCode(play({ event: 'Home Run', eventType: 'home_run' }), runner({})).code).toBe('HR');
  });

  it('codes batted-ball outs by trajectory', () => {
    const groundout = play({ event: 'Groundout', eventType: 'field_out' });
    expect(buildBatterCode(groundout, runner({ credits: [credit('SS', 'f_assist'), credit('1B', 'f_putout')] })).code).toBe('6-3');
    expect(buildBatterCode(play({ event: 'Flyout', eventType: 'field_out' }), runner({ credits: [credit('CF', 'f_putout')] })).code).toBe('F8');
    expect(buildBatterCode(play({ event: 'Lineout', eventType: 'field_out' }), runner({ credits: [credit('2B', 'f_putout')] })).code).toBe('L4');
    expect(buildBatterCode(play({ event: 'Pop Out', eventType: 'field_out' }), runner({ credits: [credit('SS', 'f_putout')] })).code).toBe('P6');
  });

  it('codes a 6-4-3 ground-into-double-play from the out runners', () => {
    const lead = runner({ isOut: true, outNumber: 1, credits: [credit('SS', 'f_assist'), credit('2B', 'f_putout')] });
    const batter = runner({ isOut: true, outNumber: 2, credits: [credit('2B', 'f_assist'), credit('1B', 'f_putout')] });
    const gidp = play({ event: 'Grounded Into DP', eventType: 'grounded_into_double_play' }, [lead, batter]);
    expect(buildBatterCode(gidp, batter).code).toBe('6-4-3');
  });

  it('codes errors, sac flies, and fielder’s choices', () => {
    expect(buildBatterCode(play({ event: 'Field Error', eventType: 'field_error' }), runner({ credits: [credit('3B', 'f_error')] })).code).toBe('E5');
    expect(buildBatterCode(play({ event: 'Sac Fly', eventType: 'sac_fly' }), runner({ credits: [credit('CF', 'f_putout')] })).code).toBe('SF8');
    expect(buildBatterCode(play({ event: 'Fielders Choice', eventType: 'fielders_choice' }), runner({ credits: [credit('SS', 'f_assist'), credit('2B', 'f_putout')] })).code).toBe('6-4');
  });

  it('falls back to the event name for unmapped events without crashing', () => {
    expect(buildBatterCode(play({ event: 'Weird Play', eventType: 'totally_new_event' }), undefined).code).toBe('Weird Play');
  });
});

describe('buildRunnerAdvancementCode', () => {
  it('codes special baserunning events', () => {
    expect(buildRunnerAdvancementCode(runner({ end: '2B', event: 'Stolen Base 2B' }), 'desc')?.code).toBe('SB');
    expect(buildRunnerAdvancementCode(runner({ end: '3B', event: 'Wild Pitch' }), 'desc')?.code).toBe('WP');
  });

  it('codes a put-out runner as the fielder chain', () => {
    const caught = runner({ isOut: true, event: 'Caught Stealing 2B', credits: [credit('C', 'f_assist'), credit('SS', 'f_putout')] });
    expect(buildRunnerAdvancementCode(caught, 'desc')?.code).toBe('2-6');
  });

  it('returns null for an ordinary advance', () => {
    expect(buildRunnerAdvancementCode(runner({ end: '2B', event: null }), 'desc')).toBeNull();
  });
});
