import { Link } from 'react-router-dom';
import type { PitchingLine } from '@mlb-scorecards/shared';

interface PitchingTableProps {
  teamName: string;
  pitching: PitchingLine[];
  seasonYear?: number | null;
}

/** Color the Stuff cell: plus stuff green, below-average red. */
function stuffClass(value: number): string {
  if (value >= 115) return ' stuff-high';
  if (value <= 85) return ' stuff-low';
  return '';
}

export function PitchingTable({ teamName, pitching, seasonYear = null }: PitchingTableProps) {
  const playerUrl = (id: number) => `/player/${id}${seasonYear ? `?season=${seasonYear}` : ''}`;
  return (
    <table className="scorecard-table pitching-table">
      <thead>
        <tr>
          <th className="scorecard-col-player">{teamName} Pitching</th>
          <th>IP</th>
          <th>H</th>
          <th>R</th>
          <th>ER</th>
          <th>BB</th>
          <th>K</th>
          <th>HR</th>
          <th>PIT</th>
          <th title="Average estimated Stuff+ over this pitcher's tracked pitches (100 = league average, higher = nastier)">
            Stuff
          </th>
        </tr>
      </thead>
      <tbody>
        {pitching.map((p) => (
          <tr key={p.id}>
            <td className="scorecard-col-player">
              <Link to={playerUrl(p.id)} className="player-link">{p.name}</Link>
              {p.decision && <span className="pitching-decision">{p.decision}</span>}
            </td>
            <td>{p.inningsPitched}</td>
            <td>{p.hits}</td>
            <td>{p.runs}</td>
            <td>{p.earnedRuns}</td>
            <td>{p.walks}</td>
            <td>{p.strikeouts}</td>
            <td>{p.homeRuns}</td>
            <td>{p.pitches}</td>
            <td className={`stuff-cell${p.stuff != null ? stuffClass(p.stuff) : ''}`}>{p.stuff ?? '—'}</td>
          </tr>
        ))}
        {pitching.length === 0 && (
          <tr>
            <td className="scorecard-col-player" colSpan={10}>
              Pitching stats not yet available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
