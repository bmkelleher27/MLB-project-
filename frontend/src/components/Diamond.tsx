import type { Cell } from '@mlb-scorecards/shared';
import type { DiamondProgress } from '../lib/diamond';

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

const ADVANCEMENT_NODE: Record<'2B' | '3B' | 'HOME', { x: number; y: number }> = {
  '2B': SECOND,
  '3B': THIRD,
  HOME,
};

const LABEL_OFFSET = 8;

function labelPos(node: { x: number; y: number }): { x: number; y: number } {
  const dx = node.x - CX;
  const dy = node.y - CY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: node.x + (dx / len) * LABEL_OFFSET, y: node.y + (dy / len) * LABEL_OFFSET };
}

export function Diamond({
  progress,
  advancement = [],
  onAdvancementClick,
}: {
  progress: DiamondProgress;
  advancement?: Cell['advancement'];
  onAdvancementClick?: (atBatIndex: number) => void;
}) {
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
    .map((a) => ({
      ...labelPos(ADVANCEMENT_NODE[a.toBase]),
      code: a.code,
      title: a.description,
      isOut: a.isOut,
      atBatIndex: a.atBatIndex,
    }));

  return (
    // Decorative: the cell's shorthand code + aria-label already convey the play.
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="diamond" aria-hidden="true">
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
          className={`diamond-advancement-label${l.isOut ? ' diamond-advancement-out' : ''}${onAdvancementClick ? ' diamond-advancement-clickable' : ''}`}
          onClick={
            onAdvancementClick
              ? (e) => {
                  e.stopPropagation();
                  onAdvancementClick(l.atBatIndex);
                }
              : undefined
          }
        >
          <title>{`${l.title} (click to show the at-bat this happened during)`}</title>
          {l.code}
        </text>
      ))}
    </svg>
  );
}
