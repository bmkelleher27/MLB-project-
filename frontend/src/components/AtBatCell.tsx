import type { Cell } from '@mlb-scorecards/shared';
import { Diamond, progressFromCell } from './Diamond';

const OUT_CIRCLES: Record<number, string> = { 1: '①', 2: '②', 3: '③' };

export function AtBatCell({ cell }: { cell: Cell }) {
  const outBadge = cell.isOut && cell.outNumber ? OUT_CIRCLES[cell.outNumber] ?? `(${cell.outNumber})` : null;

  return (
    <div className="at-bat-cell" title={cell.description}>
      <span className="at-bat-count">
        {cell.count.balls}-{cell.count.strikes}
      </span>
      {(outBadge || cell.rbi > 0) && (
        <div className="at-bat-cell-top">
          {outBadge && <span className="at-bat-out-badge">{outBadge}</span>}
          {cell.rbi > 0 && <span className="at-bat-rbi-badge">{cell.rbi} RBI</span>}
        </div>
      )}
      <div className="at-bat-cell-main">
        <Diamond progress={progressFromCell(cell)} />
        <span className="at-bat-code">{cell.code}</span>
      </div>
    </div>
  );
}
