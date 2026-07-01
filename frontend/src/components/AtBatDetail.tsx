import type { Cell } from '@mlb-scorecards/shared';

function advancementLabel(a: Cell['advancement'][number]): string {
  const outcome = a.isOut ? 'out' : a.toBase === 'HOME' ? 'scored' : `to ${a.toBase}`;
  return a.code ? `${a.code} — ${outcome}` : outcome;
}

export function AtBatDetail({
  cell,
  onClose,
  onAdvancementClick,
}: {
  cell: Cell;
  onClose: () => void;
  onAdvancementClick: (atBatIndex: number) => void;
}) {
  return (
    <div className="at-bat-detail">
      <div className="at-bat-detail-header">
        <span className="at-bat-detail-inning">
          {cell.halfInning === 'top' ? '▲ Top' : '▼ Bottom'} {cell.inning}
        </span>
        <span className="at-bat-detail-batter">{cell.batterName}</span>
        <span className="at-bat-detail-code">{cell.code}</span>
        <button className="at-bat-detail-close" onClick={onClose} aria-label="Close play details">
          ✕
        </button>
      </div>
      <p className="at-bat-detail-desc">{cell.description}</p>
      <div className="at-bat-detail-facts">
        <span>Final count {cell.count.balls}-{cell.count.strikes}</span>
        {cell.rbi > 0 && <span>{cell.rbi} RBI</span>}
        {cell.isOut && cell.outNumber != null && <span>Out #{cell.outNumber} of the inning</span>}
        {cell.exitVelocity != null && <span>{Math.round(cell.exitVelocity)} mph off the bat</span>}
        {cell.distance != null && <span>{cell.distance} ft</span>}
      </div>
      {cell.advancement.length > 0 && (
        <div className="at-bat-detail-adv">
          <span className="at-bat-detail-adv-title">On the bases afterwards:</span>
          {cell.advancement.map((a, i) => (
            <button
              key={i}
              className="at-bat-detail-adv-item"
              onClick={() => onAdvancementClick(a.atBatIndex)}
              title={`${a.description} (click to show the at-bat this happened during)`}
            >
              {advancementLabel(a)} ↗
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
