import type { BasesReached } from '@mlb-scorecards/shared';

const SIZE = 26;
const R = 9;
const CX = SIZE / 2;
const CY = SIZE / 2;

const HOME = { x: CX, y: CY + R };
const FIRST = { x: CX + R, y: CY };
const SECOND = { x: CX, y: CY - R };
const THIRD = { x: CX - R, y: CY };

function pt(p: { x: number; y: number }): string {
  return `${p.x},${p.y}`;
}

function highlightPath(reached: BasesReached, scored: boolean): string | null {
  if (reached === 'out') return null;
  const points = [HOME, FIRST];
  if (reached === '2B' || reached === '3B' || reached === 'HR' || scored) points.push(SECOND);
  if (reached === '3B' || reached === 'HR' || scored) points.push(THIRD);
  if (reached === 'HR' || scored) points.push(HOME);
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${pt(p)}`).join(' ');
}

export function Diamond({ reached, scored }: { reached: BasesReached; scored: boolean }) {
  const outline = `M${pt(HOME)} L${pt(FIRST)} L${pt(SECOND)} L${pt(THIRD)} Z`;
  const highlight = highlightPath(reached, scored);
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="diamond">
      <path d={outline} className="diamond-outline" fill="none" />
      {highlight && (
        <path d={highlight} className={`diamond-path${scored ? ' diamond-scored' : ''}`} fill="none" />
      )}
    </svg>
  );
}
