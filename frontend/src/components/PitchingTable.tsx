import { Link } from 'react-router-dom';
import type { PitchingLine } from '@mlb-scorecards/shared';
import { STUFF_BANDS_TEXT, stuffGrade } from '../lib/stuffGrade';

interface PitchingTableProps {
  teamName: string;
  pitching: PitchingLine[];
  seasonYear?: number | null;
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
          <th title={`Average estimated Stuff+ over this pitcher's tracked pitches. ${STUFF_BANDS_TEXT}`}>
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
            <td
              className={`stuff-cell${p.stuff != null ? stuffGrade(p.stuff).className : ''}`}
              title={p.stuff != null ? `${stuffGrade(p.stuff).label} stuff` : undefined}
            >
              {p.stuff != null ? (
                <>
                  {p.stuff}
                  {stuffGrade(p.stuff).symbol && <sup className="stuff-grade-symbol">{stuffGrade(p.stuff).symbol}</sup>}
                </>
              ) : (
                '—'
              )}
            </td>
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
