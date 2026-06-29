import type { Cell } from '@mlb-scorecards/shared';
import { Diamond } from './Diamond';

const OUT_CIRCLES: Record<number, string> = { 1: '①', 2: '②', 3: '③' };

export function AtBatCell({ cell }: { cell: Cell }) {
  const outBadge = cell.isOut && cell.outNumber ? OUT_CIRCLES[cell.outNumber] ?? `(${cell.outNumber})` : null;

  return (
    <div className="at-bat-cell" title={cell.description}>
      <div className="at-bat-cell-top">
        <span className="at-bat-count">
          {cell.count.balls}-{cell.count.strikes}
        </span>
        {outBadge && <span className="at-bat-out-badge">{outBadge}</span>}
        {cell.rbi > 0 && <span className="at-bat-rbi-badge">{cell.rbi} RBI</span>}
      </div>
      <div className="at-bat-cell-main">
        <Diamond reached={cell.basesReached} scored={cell.scored} />
        <span className="at-bat-code">{cell.code}</span>
      </div>
      {cell.advancement.length > 0 && (
        <div className="at-bat-advancement">
          {cell.advancement.map((a, i) => (
            <span key={i} className={`advancement-chip${a.isOut ? ' advancement-out' : ''}`} title={a.description}>
              {a.toBase === 'HOME' ? 'H' : a.toBase}
              {a.code ? `:${a.code}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
