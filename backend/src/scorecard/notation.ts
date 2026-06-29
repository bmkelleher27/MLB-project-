import type { RawPlay, RawRunner, RawRunnerCredit } from '../mlbApi.js';

export const POSITION_NUMBER: Record<string, number> = {
  P: 1,
  C: 2,
  '1B': 3,
  '2B': 4,
  '3B': 5,
  SS: 6,
  LF: 7,
  CF: 8,
  RF: 9,
  DH: 10,
};

function positionNumber(abbr: string | undefined): number | null {
  if (!abbr) return null;
  return POSITION_NUMBER[abbr] ?? null;
}

// Assists (in order) followed by the putout - the standard scorebook fielding chain.
export function creditChain(credits: RawRunnerCredit[]): number[] {
  return credits
    .filter((c) => c.credit === 'f_assist' || c.credit === 'f_putout')
    .map((c) => positionNumber(c.position?.abbreviation))
    .filter((n): n is number => n !== null);
}

function findCredit(credits: RawRunnerCredit[], creditType: string): number | null {
  const c = credits.find((c) => c.credit === creditType);
  return c ? positionNumber(c.position?.abbreviation) : null;
}

// For a multi-out play (double/triple play): the first out's full chain, then
// only the final putout of each subsequent out (earlier assists are the same
// physical touches already represented in the first out's chain).
export function combinedOutChain(outRunnersInOrder: RawRunner[]): number[] {
  if (outRunnersInOrder.length === 0) return [];
  const [first, ...rest] = outRunnersInOrder;
  const chain = [...creditChain(first.credits)];
  for (const r of rest) {
    const putout = findCredit(r.credits, 'f_putout');
    if (putout !== null) chain.push(putout);
  }
  return chain;
}

export interface CodeResult {
  code: string;
  description: string;
}

const HIT_CODES: Record<string, string> = {
  single: '1B',
  double: '2B',
  triple: '3B',
  home_run: 'HR',
};

function isCalledStrikeout(description: string): boolean {
  return /call(ed)? out on strikes|strikes out looking/i.test(description);
}

/** Code for the batter's own plate-appearance cell. */
export function buildBatterCode(play: RawPlay, batterRunner: RawRunner | undefined): CodeResult {
  const { event, eventType, description } = play.result;
  const batterCredits = batterRunner?.credits ?? [];

  if (eventType === 'strikeout') {
    return { code: isCalledStrikeout(description) ? 'ꓘ' : 'K', description };
  }
  if (eventType === 'walk') return { code: 'BB', description };
  if (eventType === 'intent_walk') return { code: 'IBB', description };
  if (eventType === 'hit_by_pitch') return { code: 'HBP', description };
  if (eventType === 'catcher_interf') return { code: 'CI', description };
  if (eventType in HIT_CODES) {
    const fielded = findCredit(batterCredits, 'f_fielded_ball');
    return { code: fielded ? `${HIT_CODES[eventType]}-${fielded}` : HIT_CODES[eventType], description };
  }
  if (eventType === 'field_error') {
    const errPos = findCredit(batterCredits, 'f_error') ?? findCredit(play.runners.flatMap((r) => r.credits), 'f_error');
    return { code: errPos ? `E${errPos}` : 'E', description };
  }
  if (eventType === 'grounded_into_double_play' || eventType === 'double_play' || eventType === 'strikeout_double_play') {
    const outRunners = [...play.runners]
      .filter((r) => r.movement.isOut)
      .sort((a, b) => (a.movement.outNumber ?? 0) - (b.movement.outNumber ?? 0));
    const chain = combinedOutChain(outRunners);
    return { code: chain.length ? chain.join('-') : 'DP', description };
  }
  if (eventType === 'triple_play') {
    const outRunners = [...play.runners]
      .filter((r) => r.movement.isOut)
      .sort((a, b) => (a.movement.outNumber ?? 0) - (b.movement.outNumber ?? 0));
    const chain = combinedOutChain(outRunners);
    return { code: chain.length ? chain.join('-') : 'TP', description };
  }
  if (eventType === 'force_out') {
    // Batter reaches safely; the out belongs to a preceding runner - borrow their chain.
    // No "FC" label needed - the batter showing safe on first already implies the choice.
    const outRunner = play.runners.find((r) => r.movement.isOut);
    const chain = outRunner ? creditChain(outRunner.credits) : [];
    return { code: chain.length ? chain.join('-') : 'FC', description };
  }
  if (eventType === 'fielders_choice' || eventType === 'fielders_choice_out') {
    const chain = creditChain(batterCredits);
    return { code: chain.length ? chain.join('-') : 'FC', description };
  }
  if (eventType === 'sac_bunt') {
    const chain = creditChain(batterCredits);
    return { code: chain.length ? `SH${chain.join('-')}` : 'SH', description };
  }
  if (eventType === 'sac_fly' || eventType === 'sac_fly_double_play') {
    const chain = creditChain(batterCredits);
    return { code: chain.length ? `SF${chain.join('-')}` : 'SF', description };
  }
  if (eventType === 'field_out') {
    const chain = creditChain(batterCredits);
    const chainStr = chain.join('-');
    const lowerEvent = event.toLowerCase();
    if (lowerEvent.includes('fly')) return { code: `F${chainStr}`, description };
    if (lowerEvent.includes('line')) return { code: `L${chainStr}`, description };
    if (lowerEvent.includes('pop')) return { code: `P${chainStr}`, description };
    return { code: chainStr || 'OUT', description }; // groundout / bunt groundout
  }

  // Defensive fallback: never throw on an unanticipated event type.
  const fallbackChain = creditChain(batterCredits);
  return { code: fallbackChain.length ? fallbackChain.join('-') : event, description };
}

// Matched by prefix since MLB suffixes some of these with the base, e.g.
// "Stolen Base 2B", "Caught Stealing 3B".
const SPECIAL_BASERUNNING_EVENTS: Array<[string, string]> = [
  ['Stolen Base', 'SB'],
  ['Caught Stealing', 'CS'],
  ['Wild Pitch', 'WP'],
  ['Passed Ball', 'PB'],
  ['Balk', 'BLK'],
  ['Disengagement Violation', 'BLK'],
  ['Pickoff Error', 'POE'],
  ['Pickoff', 'PO'],
  ['Defensive Indiff', 'DI'],
  ['Runner Out', 'OUT'],
  ['Error', 'E'],
];

/**
 * Code for a runner who is *not* the batter on this play - either advancing,
 * scoring, or getting put out (e.g. caught stealing, thrown out advancing,
 * the lead runner in a double play). Returns null when the movement is just
 * an ordinary advance caused by the batted ball - the diamond fill already
 * communicates that, no annotation needed.
 */
export function buildRunnerAdvancementCode(runner: RawRunner, playDescription: string): CodeResult | null {
  const eventLabel = runner.details.event ?? '';

  if (runner.movement.isOut) {
    const chain = creditChain(runner.credits);
    return { code: chain.length ? chain.join('-') : 'OUT', description: playDescription };
  }
  const match = SPECIAL_BASERUNNING_EVENTS.find(([prefix]) => eventLabel.startsWith(prefix));
  if (match) {
    let code = match[1];
    if (match[0] === 'Error') {
      const errPos = findCredit(runner.credits, 'f_error');
      if (errPos) code = `E${errPos}`;
    }
    return { code, description: playDescription };
  }
  return null;
}
