import { Link } from 'react-router-dom';
import type { ScheduleGame } from '@mlb-scorecards/shared';

function statusLabel(game: ScheduleGame): string {
  if (game.status.abstractGameState === 'Live') {
    const half = game.inningState ?? '';
    return game.inning ? `${half} ${game.inning}` : 'Live';
  }
  return game.status.detailedState;
}

export function GameCard({ game }: { game: ScheduleGame }) {
  const isLive = game.status.abstractGameState === 'Live';
  const isFinal = game.status.abstractGameState === 'Final';
  const showScore = isLive || isFinal;

  return (
    <Link to={`/game/${game.gamePk}`} className={`game-card${isLive ? ' game-card-live' : ''}`}>
      <div className="game-card-status">{statusLabel(game)}</div>
      <div className="game-card-team">
        <span className="game-card-team-name">{game.away.name}</span>
        {showScore && <span className="game-card-team-score">{game.away.score ?? 0}</span>}
      </div>
      <div className="game-card-team">
        <span className="game-card-team-name">{game.home.name}</span>
        {showScore && <span className="game-card-team-score">{game.home.score ?? 0}</span>}
      </div>
      {game.venue && <div className="game-card-venue">{game.venue}</div>}
    </Link>
  );
}
