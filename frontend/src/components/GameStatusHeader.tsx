import type { BaseState, Scorecard } from '@mlb-scorecards/shared';

function MiniBases({ bases }: { bases: BaseState }) {
  return (
    <div
      className="mini-bases"
      title={`1st ${bases.first ? 'occupied' : 'empty'}, 2nd ${bases.second ? 'occupied' : 'empty'}, 3rd ${bases.third ? 'occupied' : 'empty'}`}
    >
      <span className={`mini-base mini-base-second${bases.second ? ' on' : ''}`} />
      <span className={`mini-base mini-base-third${bases.third ? ' on' : ''}`} />
      <span className={`mini-base mini-base-first${bases.first ? ' on' : ''}`} />
    </div>
  );
}

export function GameStatusHeader({ scorecard }: { scorecard: Scorecard }) {
  const isLive = scorecard.status.abstractGameState === 'Live';
  const isFinal = scorecard.status.abstractGameState === 'Final';

  return (
    <div className={`game-status-header${isLive ? ' game-status-header-live' : ''}${isFinal ? ' game-status-header-final' : ''}`}>
      <div className="game-status-matchup">
        <div className="game-status-team-block">
          <span className="game-status-team-label">AWAY</span>
          <span className="game-status-team-name">{scorecard.teams.away.team.name}</span>
          <span className="game-status-score">{scorecard.totals.away.r}</span>
        </div>
        <div className="game-status-at">@</div>
        <div className="game-status-team-block">
          <span className="game-status-team-label">HOME</span>
          <span className="game-status-team-name">{scorecard.teams.home.team.name}</span>
          <span className="game-status-score">{scorecard.totals.home.r}</span>
        </div>
      </div>

      <table className="game-status-rhe-table" aria-label="Runs, hits, and errors by team">
        <thead>
          <tr>
            <th />
            <th>R</th>
            <th>H</th>
            <th>E</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="game-status-rhe-abbr">{scorecard.teams.away.team.abbreviation}</td>
            <td>{scorecard.totals.away.r}</td>
            <td>{scorecard.totals.away.h}</td>
            <td>{scorecard.totals.away.e}</td>
          </tr>
          <tr>
            <td className="game-status-rhe-abbr">{scorecard.teams.home.team.abbreviation}</td>
            <td>{scorecard.totals.home.r}</td>
            <td>{scorecard.totals.home.h}</td>
            <td>{scorecard.totals.home.e}</td>
          </tr>
        </tbody>
      </table>

      <div className="game-status-state">
        {isLive && (
          <>
            <div className="game-status-live-badge">
              <span className="live-dot" />
              LIVE
            </div>
            <span className="game-status-inning">
              {scorecard.halfInning === 'top' ? '▲' : '▼'} {scorecard.inning}
            </span>
            <span className="game-status-count">{scorecard.balls}-{scorecard.strikes}</span>
            <span className="game-status-outs">{scorecard.outs} out{scorecard.outs === 1 ? '' : 's'}</span>
            <MiniBases bases={scorecard.bases} />
          </>
        )}
        {isFinal && <span className="game-status-final-badge">FINAL</span>}
        {!isLive && !isFinal && (
          <span className="game-status-detail">{scorecard.status.detailedState}</span>
        )}
        {scorecard.venue && (
          <span className="game-status-venue">{scorecard.venue}</span>
        )}
      </div>
    </div>
  );
}
