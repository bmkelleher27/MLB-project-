import type { InningLine, TeamScorecard, TeamTotals } from '@mlb-scorecards/shared';
import { AtBatCell } from './AtBatCell';
import { getTeamColor } from '../teamColors';

interface ScorecardTableProps {
  team: TeamScorecard;
  linescore: InningLine[];
  totals: TeamTotals;
  side: 'away' | 'home';
}

export function ScorecardTable({ team, linescore, totals, side }: ScorecardTableProps) {
  const maxInningFromCells = Math.max(
    0,
    ...Object.values(team.cellsBySlot).flatMap((cells) => cells.map((c) => c.inning))
  );
  const inningCount = Math.max(linescore.length, maxInningFromCells, 9);
  const inningNums = Array.from({ length: inningCount }, (_, i) => i + 1);
  const lineFor = (n: number) => linescore.find((l) => l.num === n);
  const totalLob = linescore.reduce((sum, l) => sum + (side === 'away' ? l.away.lob : l.home.lob), 0);

  const teamColor = getTeamColor(team.team.id);

  return (
    <div className="scorecard-table-wrapper">
    <table className="scorecard-table">
      <thead>
        <tr>
          <th
            className="scorecard-col-player"
            style={{ backgroundColor: teamColor.bg, color: teamColor.text }}
          >
            {team.team.name}
          </th>
          {inningNums.map((n) => (
            <th key={n}>{n}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {team.lineup.map((slot) => {
          const cells = team.cellsBySlot[slot.slot] ?? [];
          return (
            <tr key={slot.slot} className={slot.slot % 2 === 0 ? 'scorecard-row-stripe' : undefined}>
              <td className="scorecard-col-player">
                {slot.players.map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && <span className="player-separator"> / </span>}
                    {p.position && <span className="player-position">{p.position}</span>}
                    {' '}{p.name}
                    {i > 0 && <span className="player-ph"> (PH)</span>}
                  </span>
                ))}
              </td>
              {inningNums.map((n) => {
                const cellsInInning = cells.filter((c) => c.inning === n);
                return (
                  <td key={n} className="scorecard-cell">
                    {cellsInInning.map((c) => (
                      <AtBatCell key={c.atBatIndex} cell={c} />
                    ))}
                  </td>
                );
              })}
              <td />
            </tr>
          );
        })}
        {team.lineup.length === 0 && (
          <tr>
            <td className="scorecard-col-player" colSpan={inningNums.length + 2}>
              Lineup not yet available
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <td className="scorecard-col-player">Runs</td>
          {inningNums.map((n) => (
            <td key={n}>{lineFor(n) ? (side === 'away' ? lineFor(n)!.away.runs : lineFor(n)!.home.runs) : ''}</td>
          ))}
          <td className="scorecard-total">{totals.r}</td>
        </tr>
        <tr>
          <td className="scorecard-col-player">Hits</td>
          {inningNums.map((n) => (
            <td key={n}>{lineFor(n) ? (side === 'away' ? lineFor(n)!.away.hits : lineFor(n)!.home.hits) : ''}</td>
          ))}
          <td className="scorecard-total">{totals.h}</td>
        </tr>
        <tr>
          <td className="scorecard-col-player">LOB</td>
          {inningNums.map((n) => (
            <td key={n}>{lineFor(n) ? (side === 'away' ? lineFor(n)!.away.lob : lineFor(n)!.home.lob) : ''}</td>
          ))}
          <td className="scorecard-total">{totalLob}</td>
        </tr>
      </tfoot>
    </table>
    </div>
  );
}
