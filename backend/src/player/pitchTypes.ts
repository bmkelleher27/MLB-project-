import type { PitchTypePerformance } from '@mlb-scorecards/shared';
import type { RawPitchLog } from '../mlbApi.js';

/**
 * Rate stats below these sample sizes are withheld rather than shown — three
 * at-bats against knuckle curves can produce a .667 that means nothing.
 * The raw counts are still reported so the reader can see why.
 */
export const MIN_AT_BATS = 10;
export const MIN_SWINGS = 10;

/** Bases credited to each plate-appearance outcome, for slugging. */
const TOTAL_BASES: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  home_run: 4,
};

/**
 * Swings are classified from the pitch's *call code*, not its event name. The
 * event name of a pitch that ends a plate appearance is the outcome
 * ("strikeout", "single"), which hides whether the batter offered — a swinging
 * strikeout is `eventType: "strikeout"` with `call.code: "S"`. Reading the call
 * is what keeps those pitches in the swing and whiff counts.
 *
 * S swinging · W swinging (blocked) · F foul · T foul tip · L foul bunt
 * M missed bunt · Q swinging pitchout · R foul pitchout · X/D/E in play
 */
const SWING_CALLS = new Set(['S', 'W', 'F', 'T', 'L', 'M', 'Q', 'R', 'X', 'D', 'E']);

/** The subset of swings that missed the ball entirely. */
const WHIFF_CALLS = new Set(['S', 'W', 'M', 'Q']);

interface Tally {
  plateAppearances: number;
  atBats: number;
  hits: number;
  totalBases: number;
  strikeouts: number;
  pitches: number;
  swings: number;
  whiffs: number;
}

function emptyTally(): Tally {
  return {
    plateAppearances: 0,
    atBats: 0,
    hits: 0,
    totalBases: 0,
    strikeouts: 0,
    pitches: 0,
    swings: 0,
    whiffs: 0,
  };
}

function ratio(numerator: number, denominator: number, min: number): number | null {
  if (denominator < min || denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 1000;
}

/**
 * Aggregates per-pitch-type performance, keyed by MLB pitch code (FF, SL, ...).
 *
 * `playLog` carries one entry per plate appearance, tagged with the pitch type
 * that *ended* it — the standard convention for "performance vs pitch type", so
 * AVG/SLG here are attributed to the finishing pitch. `pitchLog` carries every
 * pitch, which is what swing and whiff rates are measured over; the two
 * therefore have deliberately different denominators.
 */
export function buildPitchTypePerformance(
  playLog: RawPitchLog,
  pitchLog: RawPitchLog
): Map<string, PitchTypePerformance> {
  const tallies = new Map<string, Tally>();
  const get = (code: string): Tally => {
    let t = tallies.get(code);
    if (!t) {
      t = emptyTally();
      tallies.set(code, t);
    }
    return t;
  };

  for (const entry of playLog.stats?.[0]?.splits ?? []) {
    const details = entry.stat?.play?.details;
    const code = details?.type?.code;
    // Pitchouts and unclassified pitches carry no type; they'd otherwise pool
    // into a meaningless bucket.
    if (!details || !code) continue;
    const t = get(code);
    if (details.isPlateAppearance) t.plateAppearances += 1;
    if (details.isAtBat) t.atBats += 1;
    if (details.isBaseHit) t.hits += 1;
    if (details.eventType === 'strikeout') t.strikeouts += 1;
    t.totalBases += TOTAL_BASES[details.eventType ?? ''] ?? 0;
  }

  for (const entry of pitchLog.stats?.[0]?.splits ?? []) {
    const details = entry.stat?.play?.details;
    const code = details?.type?.code;
    if (!details || !code) continue;
    const t = get(code);
    t.pitches += 1;
    const call = details.call?.code ?? '';
    // `isInPlay` is a safety net for any in-play call code not listed above.
    if (SWING_CALLS.has(call) || details.isInPlay) t.swings += 1;
    if (WHIFF_CALLS.has(call)) t.whiffs += 1;
  }

  const out = new Map<string, PitchTypePerformance>();
  for (const [code, t] of tallies) {
    out.set(code, {
      plateAppearances: t.plateAppearances,
      atBats: t.atBats,
      hits: t.hits,
      totalBases: t.totalBases,
      strikeouts: t.strikeouts,
      swings: t.swings,
      whiffs: t.whiffs,
      avg: ratio(t.hits, t.atBats, MIN_AT_BATS),
      slg: ratio(t.totalBases, t.atBats, MIN_AT_BATS),
      strikeoutRate: ratio(t.strikeouts, t.plateAppearances, MIN_AT_BATS),
      whiffRate: ratio(t.whiffs, t.swings, MIN_SWINGS),
      lowSample: t.atBats < MIN_AT_BATS,
    });
  }
  return out;
}
