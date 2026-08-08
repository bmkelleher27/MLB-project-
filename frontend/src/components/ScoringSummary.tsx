import type { Cell, Scorecard } from '@mlb-scorecards/shared';

interface ScoringPlay {
  cell: Cell;
  teamAbbr: string;
}

export function ScoringSummary({
  scorecard,
  onJump,
}: {
  scorecard: Scorecard;
  onJump: (atBatIndex: number) => void;
}) {
  const plays: ScoringPlay[] = [];
  for (const side of ['away', 'home'] as const) {
    const team = scorecard.teams[side];
    for (const cells of Object.values(team.cellsBySlot)) {
      for (const cell of cells) {
        if (cell.rbi > 0) plays.push({ cell, teamAbbr: team.team.abbreviation });
      }
    }
  }
  plays.sort((a, b) => a.cell.atBatIndex - b.cell.atBatIndex);

  if (plays.length === 0) return null;

  return (
    <div className="scoring-summary">
      <span className="scoring-summary-title">Scoring plays</span>
      <div className="scoring-summary-chips">
        {plays.map(({ cell, teamAbbr }) => (
          <button
            key={cell.atBatIndex}
            className="scoring-chip"
            onClick={() => onJump(cell.atBatIndex)}
            title={`${cell.description} (click to show on the scorecard)`}
          >
            <span className="scoring-chip-inning">
              {cell.halfInning === 'top' ? 'T' : 'B'}{cell.inning}
            </span>
            <span className="scoring-chip-team">{teamAbbr}</span>
            {cell.batterName} — <span className="scoring-chip-code">{cell.code}</span>, {cell.rbi} RBI
          </button>
        ))}
      </div>
    </div>
  );
}
