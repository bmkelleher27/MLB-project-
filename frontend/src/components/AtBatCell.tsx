import type { Cell } from '@mlb-scorecards/shared';
import { progressFromCell } from '../lib/diamond';
import { Diamond } from './Diamond';

const OUT_CIRCLES: Record<number, string> = { 1: '①', 2: '②', 3: '③' };

interface AtBatCellProps {
  cell: Cell;
  selected?: boolean;
  onSelect?: (cell: Cell) => void;
  /** Replay mode: hide this cell if its at-bat hasn't happened yet, and drop later runner advancements. */
  replayLimit?: number | null;
  onAdvancementClick?: (atBatIndex: number) => void;
}

export function AtBatCell({ cell, selected, onSelect, replayLimit = null, onAdvancementClick }: AtBatCellProps) {
  const hidden = replayLimit !== null && cell.atBatIndex > replayLimit;
  const isCurrent = replayLimit !== null && cell.atBatIndex === replayLimit;
  const advancement =
    replayLimit === null ? cell.advancement : cell.advancement.filter((a) => a.atBatIndex <= replayLimit);

  const outBadge = cell.isOut && cell.outNumber ? OUT_CIRCLES[cell.outNumber] ?? `(${cell.outNumber})` : null;
  const progress = progressFromCell({ ...cell, advancement });
  const scored = progress.base === 4 && !progress.isOut;
  const out = cell.isOut || progress.isOut;
  const stateClass = scored ? ' at-bat-cell-scored' : out ? ' at-bat-cell-out' : '';
  const modeClass = `${hidden ? ' at-bat-cell-hidden' : ''}${isCurrent ? ' at-bat-cell-current' : ''}${
    selected ? ' at-bat-cell-selected' : ''
  }${onSelect ? ' at-bat-cell-clickable' : ''}`;

  const interactive = Boolean(onSelect);

  return (
    <div
      className={`at-bat-cell${stateClass}${modeClass}`}
      title={cell.description}
      data-at-bat-index={cell.atBatIndex}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${cell.batterName}: ${cell.description}` : undefined}
      onClick={onSelect ? () => onSelect(cell) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(cell);
              }
            }
          : undefined
      }
    >
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
        <Diamond progress={progress} advancement={advancement} onAdvancementClick={onAdvancementClick} />
        <span className="at-bat-code">{cell.code}</span>
      </div>
      {cell.basesReached === 'HR' && (cell.distance || cell.exitVelocity) && (
        <div className="hr-data">
          {cell.distance && <span>{cell.distance} ft</span>}
          {cell.exitVelocity && <span>{Math.round(cell.exitVelocity)} mph</span>}
        </div>
      )}
    </div>
  );
}
