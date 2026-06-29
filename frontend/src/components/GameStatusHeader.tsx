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

  return (
    <div className="game-status-header">
      <div className="game-status-teams">
        <div className="game-status-team">
          <span className="team-name">{scorecard.teams.away.team.name}</span>
          <span className="team-line">
            R{scorecard.totals.away.r} H{scorecard.totals.away.h} E{scorecard.totals.away.e}
          </span>
        </div>
        <div className="game-status-team">
          <span className="team-name">{scorecard.teams.home.team.name}</span>
          <span className="team-line">
            R{scorecard.totals.home.r} H{scorecard.totals.home.h} E{scorecard.totals.home.e}
          </span>
        </div>
      </div>
      <div className="game-status-state">
        <span className="game-status-detail">{scorecard.status.detailedState}</span>
        {isLive && (
          <>
            <span className="game-status-inning">
              {scorecard.halfInning === 'top' ? '▲' : '▼'} {scorecard.inning}
            </span>
            <span className="game-status-count">
              {scorecard.balls}-{scorecard.strikes}
            </span>
            <span className="game-status-outs">{scorecard.outs} out{scorecard.outs === 1 ? '' : 's'}</span>
            <MiniBases bases={scorecard.bases} />
          </>
        )}
      </div>
      {scorecard.venue && <div className="game-status-venue">{scorecard.venue}</div>}
    </div>
  );
}
