import type { RawLiveFeed, RawPlay } from '../mlbApi.js';
import type { PredictiveBatter, PredictivePitcher, TeamPredictive } from '@mlb-scorecards/shared';

/**
 * Process-based predictive metrics, both indexed so 100 = league average.
 *
 * DMG (Damage Index, batters): expected production per plate appearance built
 * from HOW each ball was struck (exit velocity + launch angle buckets that
 * approximate Statcast's xwOBA-on-contact) plus plate discipline (walks help,
 * strikeouts hurt) - never from where the ball happened to land. Contact
 * quality stabilizes far faster than batting average, which is what makes
 * this predictive rather than descriptive.
 *
 * DOM (Dominance Index, pitchers): CSW rate (called strikes + whiffs per
 * pitch - the best simple public predictor of pitcher skill) blended with
 * contact suppression (expected damage on the batted balls allowed).
 * Independent of runs/hits, so a pitcher BABIP'd to death still grades well.
 */

const LEAGUE_WOBA = 0.32; // average production per PA
const LEAGUE_XCON = 0.37; // average expected production per batted ball
const LEAGUE_CSW = 0.29; // average called-strike + whiff rate
const WALK_VALUE = 0.69; // wOBA weight of a walk/HBP

const HARD_HIT_EV = 95;

/**
 * Statcast barrel approximation: EV >= 98 with launch angle inside a window
 * centered on ~26-30 deg that widens as EV climbs (at 116+ it spans 8-50).
 */
function isBarrel(ev: number, la: number): boolean {
  if (ev < 98) return false;
  const low = Math.max(8, 26 - (ev - 98) * 1.7);
  const high = Math.min(50, 30 + (ev - 98) * 2.0);
  return la >= low && la <= high;
}

/** Expected production of a batted ball from EV/LA (xwOBA-on-contact buckets). */
function contactValue(ev: number | undefined, la: number | undefined): number {
  if (ev == null || la == null) return LEAGUE_XCON; // untracked (e.g. pre-2015)
  if (isBarrel(ev, la)) return 1.3;
  if (ev >= HARD_HIT_EV) return la >= 8 && la <= 40 ? 0.7 : 0.35;
  if (ev >= 80) return la >= 8 && la <= 32 ? 0.42 : 0.22;
  return 0.18;
}

const K_EVENTS = new Set(['strikeout', 'strikeout_double_play', 'strikeout_triple_play']);
const WALK_EVENTS = new Set(['walk', 'intent_walk', 'hit_by_pitch', 'catcher_interf']);

const CALLED_STRIKE_CODES = new Set(['C']);
// S swinging strike, W swinging strike blocked, T foul tip, M missed bunt
const WHIFF_CODES = new Set(['S', 'W', 'T', 'M']);

export interface BatterAcc {
  id: number;
  name: string;
  pa: number;
  strikeouts: number;
  walks: number;
  battedBalls: number;
  barrels: number;
  hardHit: number;
  evSum: number;
  evCount: number;
  valueSum: number;
}

export interface PitcherAcc {
  id: number;
  name: string;
  pitches: number;
  calledStrikes: number;
  whiffs: number;
  battedBallsAllowed: number;
  hardHitAllowed: number;
  evSum: number;
  evCount: number;
  conValueSum: number;
}

function getBatterAcc(map: Map<number, BatterAcc>, id: number, name: string): BatterAcc {
  let acc = map.get(id);
  if (!acc) {
    acc = { id, name, pa: 0, strikeouts: 0, walks: 0, battedBalls: 0, barrels: 0, hardHit: 0, evSum: 0, evCount: 0, valueSum: 0 };
    map.set(id, acc);
  }
  return acc;
}

function getPitcherAcc(map: Map<number, PitcherAcc>, id: number, name: string): PitcherAcc {
  let acc = map.get(id);
  if (!acc) {
    acc = { id, name, pitches: 0, calledStrikes: 0, whiffs: 0, battedBallsAllowed: 0, hardHitAllowed: 0, evSum: 0, evCount: 0, conValueSum: 0 };
    map.set(id, acc);
  }
  return acc;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function accumulatePlay(play: RawPlay, batters: Map<number, BatterAcc>, pitchers: Map<number, PitcherAcc>): void {
  const pitcher = getPitcherAcc(pitchers, play.matchup.pitcher.id, play.matchup.pitcher.fullName);
  const inPlayEvent = play.playEvents?.find((e) => e.details?.isInPlay);
  const hitData = inPlayEvent?.hitData ?? play.playEvents?.find((e) => e.hitData)?.hitData;

  for (const e of play.playEvents ?? []) {
    if (!e.isPitch) continue;
    pitcher.pitches += 1;
    const code = e.details?.call?.code ?? '';
    if (CALLED_STRIKE_CODES.has(code)) pitcher.calledStrikes += 1;
    if (WHIFF_CODES.has(code)) pitcher.whiffs += 1;
  }

  // The batter's plate-appearance outcome only counts once it's complete and
  // the batter actually has a runner entry (mid-at-bat baserunning plays are
  // tagged result.type 'atBat' too, but carry no PA outcome for the batter).
  if (!play.about.isComplete || play.result.type !== 'atBat') return;
  const batterId = play.matchup.batter.id;
  if (!play.runners.some((r) => r.details.runner.id === batterId)) return;

  const batter = getBatterAcc(batters, batterId, play.matchup.batter.fullName);
  batter.pa += 1;

  const eventType = play.result.eventType;
  if (K_EVENTS.has(eventType)) {
    batter.strikeouts += 1;
    return; // strikeout contributes 0 expected production
  }
  if (WALK_EVENTS.has(eventType)) {
    batter.walks += 1;
    batter.valueSum += WALK_VALUE;
    return;
  }

  // Batted ball (or untracked in-play event): value it by contact quality.
  const ev = hitData?.launchSpeed;
  const la = hitData?.launchAngle;
  const value = contactValue(ev, la);
  batter.battedBalls += 1;
  batter.valueSum += value;
  pitcher.battedBallsAllowed += 1;
  pitcher.conValueSum += value;
  if (ev != null) {
    batter.evSum += ev;
    batter.evCount += 1;
    pitcher.evSum += ev;
    pitcher.evCount += 1;
    if (la != null && isBarrel(ev, la)) batter.barrels += 1;
    if (ev >= HARD_HIT_EV) {
      batter.hardHit += 1;
      pitcher.hardHitAllowed += 1;
    }
  }
}

export function finalizeBatter(acc: BatterAcc): PredictiveBatter {
  const xPerPa = acc.pa > 0 ? acc.valueSum / acc.pa : 0;
  return {
    id: acc.id,
    name: acc.name,
    pa: acc.pa,
    strikeouts: acc.strikeouts,
    walks: acc.walks,
    battedBalls: acc.battedBalls,
    barrels: acc.barrels,
    hardHit: acc.hardHit,
    avgEV: acc.evCount > 0 ? round1(acc.evSum / acc.evCount) : null,
    dmg: Math.round((xPerPa / LEAGUE_WOBA) * 100),
  };
}

export function finalizePitcher(acc: PitcherAcc): PredictivePitcher {
  const csw = acc.pitches > 0 ? (acc.calledStrikes + acc.whiffs) / acc.pitches : 0;
  const xCon = acc.battedBallsAllowed > 0 ? acc.conValueSum / acc.battedBallsAllowed : LEAGUE_XCON;
  // Clamped at 0: tiny samples (a reliever's 8-pitch outing) can go negative.
  const dom = Math.max(0, 100 + 350 * (csw - LEAGUE_CSW) - 200 * (xCon - LEAGUE_XCON));
  return {
    id: acc.id,
    name: acc.name,
    pitches: acc.pitches,
    calledStrikes: acc.calledStrikes,
    whiffs: acc.whiffs,
    csw: Math.round(csw * 1000) / 1000,
    battedBallsAllowed: acc.battedBallsAllowed,
    hardHitAllowed: acc.hardHitAllowed,
    avgEVAllowed: acc.evCount > 0 ? round1(acc.evSum / acc.evCount) : null,
    dom: Math.round(dom),
  };
}

export interface SideMaps {
  awayBatters: Map<number, BatterAcc>;
  homeBatters: Map<number, BatterAcc>;
  awayPitchers: Map<number, PitcherAcc>;
  homePitchers: Map<number, PitcherAcc>;
}

export function newSideMaps(): SideMaps {
  return {
    awayBatters: new Map(),
    homeBatters: new Map(),
    awayPitchers: new Map(),
    homePitchers: new Map(),
  };
}

/** Accumulate one game's plays into the given maps (reusable across games). */
export function accumulateFeed(raw: RawLiveFeed, maps: SideMaps): void {
  // Away bats in the top half; the pitcher on any play belongs to the fielding team.
  for (const play of raw.liveData.plays.allPlays) {
    if (!play.matchup?.pitcher?.id) continue;
    if (play.about.halfInning === 'top') {
      accumulatePlay(play, maps.awayBatters, maps.homePitchers);
    } else {
      accumulatePlay(play, maps.homeBatters, maps.awayPitchers);
    }
  }
}

export function buildPredictive(raw: RawLiveFeed): { away: TeamPredictive; home: TeamPredictive } {
  const maps = newSideMaps();
  accumulateFeed(raw, maps);
  const { awayBatters, homeBatters, awayPitchers, homePitchers } = maps;

  const finalize = (batters: Map<number, BatterAcc>, pitchers: Map<number, PitcherAcc>): TeamPredictive => ({
    batters: [...batters.values()]
      .filter((b) => b.pa > 0)
      .map(finalizeBatter)
      .sort((a, b) => b.dmg - a.dmg),
    pitchers: [...pitchers.values()]
      .filter((p) => p.pitches > 0)
      .map(finalizePitcher)
      .sort((a, b) => b.dom - a.dom),
  });

  return {
    away: finalize(awayBatters, awayPitchers),
    home: finalize(homeBatters, homePitchers),
  };
}
