import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Cell, InningLine, TeamScorecard, TeamTotals } from '@mlb-scorecards/shared';
import { AtBatCell } from './AtBatCell';
import { getTeamColor } from '../teamColors';

interface ScorecardTableProps {
  team: TeamScorecard;
  linescore: InningLine[];
  totals: TeamTotals;
  side: 'away' | 'home';
  /** Inning to tint in the header while this team is batting live. */
  currentInning?: number | null;
  selectedAtBatIndex?: number | null;
  replayLimit?: number | null;
  onSelectCell?: (cell: Cell) => void;
  onAdvancementClick?: (atBatIndex: number) => void;
  /** Used to link player names to their game log for the right season. */
  seasonYear?: number | null;
}

export function ScorecardTable({
  team,
  linescore,
  totals,
  side,
  currentInning = null,
  selectedAtBatIndex = null,
  replayLimit = null,
  onSelectCell,
  onAdvancementClick,
  seasonYear = null,
}: ScorecardTableProps) {
  const [hoverInning, setHoverInning] = useState<number | null>(null);

  const maxInningFromCells = Math.max(
    0,
    ...Object.values(team.cellsBySlot).flatMap((cells) => cells.map((c) => c.inning))
  );
  const inningCount = Math.max(linescore.length, maxInningFromCells, 9);
  const inningNums = Array.from({ length: inningCount }, (_, i) => i + 1);
  // When the team bats around, a slot can come up more than once in an inning.
  // Scorebook convention: the inning spills into extra column(s) — one column
  // per "pass", with the inning number heading the whole group.
  const passesFor = (n: number) =>
    Math.max(
      1,
      ...Object.values(team.cellsBySlot).map((cells) => cells.filter((c) => c.inning === n).length)
    );
  const inningGroups = inningNums.map((n) => ({ num: n, passes: passesFor(n) }));
  const lineFor = (n: number) => linescore.find((l) => l.num === n);
  const totalLob = linescore.reduce((sum, l) => sum + (side === 'away' ? l.away.lob : l.home.lob), 0);

  const teamColor = getTeamColor(team.team.id);

  const inningColClass = (n: number) =>
    `${n === hoverInning ? ' inning-col-hover' : ''}${n === currentInning ? ' inning-col-current' : ''}`;

  return (
    <div className="scorecard-table-wrapper" data-side={side}>
    <table className="scorecard-table">
      <thead>
        <tr>
          <th
            className="scorecard-col-player"
            style={{ backgroundColor: teamColor.bg, color: teamColor.text }}
          >
            {team.team.name}
          </th>
          {inningGroups.map((g) => (
            <th
              key={g.num}
              colSpan={g.passes}
              className={inningColClass(g.num) || undefined}
              onMouseEnter={() => setHoverInning(g.num)}
              onMouseLeave={() => setHoverInning(null)}
              title={g.passes > 1 ? `Batted around — inning ${g.num} uses ${g.passes} columns` : undefined}
            >
              {g.num}
            </th>
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
                  <span key={p.id} className={i > 0 ? 'player-sub-line' : undefined}>
                    {p.position && <span className="player-position">{p.position}</span>}
                    {' '}
                    <Link
                      to={`/player/${p.id}${seasonYear ? `?season=${seasonYear}` : ''}`}
                      className="player-link"
                    >
                      {p.name}
                    </Link>
                    {i > 0 && <span className="player-ph"> (PH)</span>}
                  </span>
                ))}
              </td>
              {inningGroups.flatMap((g) => {
                const cellsInInning = cells.filter((c) => c.inning === g.num);
                return Array.from({ length: g.passes }, (_, pass) => {
                  const c = cellsInInning[pass];
                  return (
                    <td
                      key={`${g.num}.${pass}`}
                      className={`scorecard-cell${inningColClass(g.num)}${pass > 0 ? ' scorecard-subcol' : ''}`}
                    >
                      {c && (
                        <AtBatCell
                          key={c.atBatIndex}
                          cell={c}
                          selected={c.atBatIndex === selectedAtBatIndex}
                          onSelect={onSelectCell}
                          replayLimit={replayLimit}
                          onAdvancementClick={onAdvancementClick}
                        />
                      )}
                    </td>
                  );
                });
              })}
              <td />
            </tr>
          );
        })}
        {team.lineup.length === 0 && (
          <tr>
            <td className="scorecard-col-player" colSpan={inningGroups.reduce((s, g) => s + g.passes, 0) + 2}>
              Lineup not yet available
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <td className="scorecard-col-player">Runs</td>
          {inningGroups.map((g) => (
            <td key={g.num} colSpan={g.passes}>
              {lineFor(g.num) ? (side === 'away' ? lineFor(g.num)!.away.runs : lineFor(g.num)!.home.runs) : ''}
            </td>
          ))}
          <td className="scorecard-total">{totals.r}</td>
        </tr>
        <tr>
          <td className="scorecard-col-player">Hits</td>
          {inningGroups.map((g) => (
            <td key={g.num} colSpan={g.passes}>
              {lineFor(g.num) ? (side === 'away' ? lineFor(g.num)!.away.hits : lineFor(g.num)!.home.hits) : ''}
            </td>
          ))}
          <td className="scorecard-total">{totals.h}</td>
        </tr>
        <tr>
          <td className="scorecard-col-player">LOB</td>
          {inningGroups.map((g) => (
            <td key={g.num} colSpan={g.passes}>
              {lineFor(g.num) ? (side === 'away' ? lineFor(g.num)!.away.lob : lineFor(g.num)!.home.lob) : ''}
            </td>
          ))}
          <td className="scorecard-total">{totalLob}</td>
        </tr>
      </tfoot>
    </table>
    </div>
  );
}
