import type { Cell } from '@mlb-scorecards/shared';

export interface DiamondProgress {
  /** Furthest base physically reached this half-inning; 4 = all the way around to home. */
  base: 0 | 1 | 2 | 3 | 4;
  /** Whether the runner was put out at `base`, rather than safe/stranded there. */
  isOut: boolean;
}

const BASE_INDEX: Record<Cell['basesReached'], 0 | 1 | 2 | 3 | 4> = {
  out: 0,
  '1B': 1,
  '2B': 2,
  '3B': 3,
  HR: 4,
};

/**
 * The cell's own at-bat only fixes where the batter started (e.g. a single = 1B).
 * Later plays in the same half-inning can advance that same runner further -
 * those are recorded as `advancement` entries on this cell, chronologically,
 * each one superseding the last (a runner can only be safe/out/scored once).
 */
export function progressFromCell(cell: Cell): DiamondProgress {
  let base = BASE_INDEX[cell.basesReached];
  let isOut = false;
  for (const adv of cell.advancement) {
    base = adv.toBase === 'HOME' ? 4 : adv.toBase === '3B' ? 3 : 2;
    isOut = adv.isOut;
  }
  return { base, isOut };
}
