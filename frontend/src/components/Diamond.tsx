import type { Cell } from '@mlb-scorecards/shared';

const SIZE = 108;
const R = 40;
const CX = SIZE / 2;
const CY = SIZE / 2;

const HOME = { x: CX, y: CY + R };
const FIRST = { x: CX + R, y: CY };
const SECOND = { x: CX, y: CY - R };
const THIRD = { x: CX - R, y: CY };
const NODES = [HOME, FIRST, SECOND, THIRD, HOME];

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

const ADVANCEMENT_NODE: Record<'2B' | '3B' | 'HOME', { x: number; y: number }> = {
  '2B': SECOND,
  '3B': THIRD,
  HOME,
};

const LABEL_OFFSET = 9;

function labelPos(node: { x: number; y: number }): { x: number; y: number } {
  const dx = node.x - CX;
  const dy = node.y - CY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: node.x + (dx / len) * LABEL_OFFSET, y: node.y + (dy / len) * LABEL_OFFSET };
}

export function Diamond({ progress, advancement = [] }: { progress: DiamondProgress; advancement?: Cell['advancement'] }) {
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
  const labels = advancement
    .filter((a) => a.code)
    .map((a) => ({ ...labelPos(ADVANCEMENT_NODE[a.toBase]), code: a.code, title: a.description, isOut: a.isOut }));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="diamond">
      <path d={outline} className="diamond-outline" fill="none" />
      {path && <path d={path} className={`diamond-path${scored ? ' diamond-scored' : ''}`} fill="none" />}
      {isOut && terminal && <circle cx={terminal.x} cy={terminal.y} r={3} className="diamond-out-marker" />}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className={`diamond-advancement-label${l.isOut ? ' diamond-advancement-out' : ''}`}
        >
          <title>{l.title}</title>
          {l.code}
        </text>
      ))}
    </svg>
  );
}
