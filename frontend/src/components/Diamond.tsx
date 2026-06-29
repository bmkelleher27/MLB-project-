import type { Cell } from '@mlb-scorecards/shared';

const SIZE = 26;
const R = 9;
const CX = SIZE / 2;
const CY = SIZE / 2;

const HOME = { x: CX, y: CY + R };
const FIRST = { x: CX + R, y: CY };
const SECOND = { x: CX, y: CY - R };
const THIRD = { x: CX - R, y: CY };
const NODES = [HOME, FIRST, SECOND, THIRD, HOME];

// Small boxed grid attached to the diamond's home-first edge - the traditional
// paper-scorecard spot for writing the play notation, kept clear of the diamond itself.
const STAIR = 6;
const STAIR_X0 = 18;
const STAIR_Y0 = 18;
const CANVAS_SIZE = STAIR_X0 + STAIR * 2;

function pt(p: { x: number; y: number }): string {
  return `${p.x},${p.y}`;
}

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

export function Diamond({ progress }: { progress: DiamondProgress }) {
  const { base, isOut } = progress;
  const outline = `M${pt(HOME)} L${pt(FIRST)} L${pt(SECOND)} L${pt(THIRD)} Z`;
  const scored = base === 4 && !isOut;
  const path =
    base > 0
      ? NODES.slice(0, base + 1)
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${pt(p)}`)
          .join(' ')
      : null;
  const terminal = base > 0 ? NODES[base === 4 ? 0 : base] : null;

  return (
    <svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} className="diamond">
      <path d={outline} className="diamond-outline" fill="none" />
      {path && <path d={path} className={`diamond-path${scored ? ' diamond-scored' : ''}`} fill="none" />}
      {isOut && terminal && <circle cx={terminal.x} cy={terminal.y} r={2.5} className="diamond-out-marker" />}
      <rect x={STAIR_X0 + STAIR} y={STAIR_Y0} width={STAIR} height={STAIR} className="diamond-stair" />
      <rect x={STAIR_X0} y={STAIR_Y0 + STAIR} width={STAIR} height={STAIR} className="diamond-stair" />
      <rect x={STAIR_X0 + STAIR} y={STAIR_Y0 + STAIR} width={STAIR} height={STAIR} className="diamond-stair" />
    </svg>
  );
}
