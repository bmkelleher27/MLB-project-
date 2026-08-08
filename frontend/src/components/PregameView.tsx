import { Link, useNavigate } from 'react-router-dom';
import type { GamePreviewResponse, GamePreviewSide } from '@mlb-scorecards/shared';
import { formatShortDate } from '../lib/date';

function PitcherPanel({ side }: { side: GamePreviewSide }) {
  const navigate = useNavigate();
  const p = side.probable;
  return (
    <div className="pregame-panel">
      <div className="pregame-panel-team">{side.team.name}</div>
      {!p ? (
        <p className="pregame-tbd">Starter TBD</p>
      ) : (
        <>
          <div className="pregame-pitcher">
            <Link to={`/player/${p.id}`} className="player-link pregame-pitcher-name">
              {p.name}
            </Link>
            {p.hand && <span className="pregame-hand">{p.hand}HP</span>}
          </div>
          {p.span && (
            <p className="pregame-span">
              Last {p.starts.length} starts: {p.span.ip} IP · <strong>{p.span.era.toFixed(2)} ERA</strong> ·{' '}
              {p.span.whip.toFixed(2)} WHIP · {p.span.kPer9.toFixed(1)} K/9
            </p>
          )}
          {p.starts.length === 0 ? (
            <p className="pregame-tbd">No starts on record.</p>
          ) : (
            <div className="pregame-table-wrapper">
              <table className="pregame-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opp</th>
                    <th title="Innings pitched">IP</th>
                    <th>H</th>
                    <th>R</th>
                    <th>ER</th>
                    <th>BB</th>
                    <th>K</th>
                    <th>HR</th>
                    <th title="Pitches thrown">P</th>
                  </tr>
                </thead>
                <tbody>
                  {p.starts.map((s) => {
                    const row = (
                      <>
                        <td>{s.date ? formatShortDate(s.date) : '—'}</td>
                        <td className="pregame-opp">
                          <span className="season-game-ha">{s.isHome ? 'vs' : '@'}</span> {s.opponentAbbr}
                        </td>
                        <td>{s.ip}</td>
                        <td>{s.hits}</td>
                        <td>{s.runs}</td>
                        <td>{s.earnedRuns}</td>
                        <td>{s.walks}</td>
                        <td>{s.strikeouts}</td>
                        <td>{s.homeRuns}</td>
                        <td>{s.pitches ?? '—'}</td>
                      </>
                    );
                    return s.gamePk ? (
                      <tr
                        key={`${s.date}-${s.gamePk}`}
                        className="pregame-row-link"
                        title="Open this game's scorecard"
                        onClick={() => navigate(`/game/${s.gamePk}`)}
                      >
                        {row}
                      </tr>
                    ) : (
                      <tr key={s.date}>{row}</tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {p.vsLineup.length > 0 && (
            <>
              <h4 className="pregame-subhead">vs. this lineup (career)</h4>
              <div className="pregame-table-wrapper">
                <table className="pregame-table">
                  <thead>
                    <tr>
                      <th className="pregame-opp">Batter</th>
                      <th>AB</th>
                      <th>H</th>
                      <th>2B</th>
                      <th>HR</th>
                      <th>BB</th>
                      <th>K</th>
                      <th>AVG</th>
                      <th>OPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.vsLineup.map((l) => (
                      <tr key={l.batterId}>
                        <td className="pregame-opp">
                          <Link to={`/player/${l.batterId}`} className="player-link">{l.name}</Link>
                        </td>
                        <td>{l.ab}</td>
                        <td>{l.hits}</td>
                        <td>{l.doubles}</td>
                        <td>{l.homeRuns}</td>
                        <td>{l.walks}</td>
                        <td>{l.strikeouts}</td>
                        <td>{l.avg}</td>
                        <td>{l.ops}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function PregameView({ preview }: { preview: GamePreviewResponse }) {
  return (
    <section className="pregame-view">
      <h2 className="pregame-title">Probable starters</h2>
      <div className="pregame-panels">
        <PitcherPanel side={preview.away} />
        <PitcherPanel side={preview.home} />
      </div>
    </section>
  );
}
