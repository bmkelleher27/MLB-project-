import { Link } from 'react-router-dom';
import type { ScheduleGame } from '@mlb-scorecards/shared';
import { formatGameTime } from '../lib/date';
import { getTeamColor } from '../teamColors';

function statusLabel(game: ScheduleGame): string {
  if (game.status.abstractGameState === 'Live') {
    const half = game.inningState ?? '';
    return game.inning ? `${half} ${game.inning}` : 'Live';
  }
  return game.status.detailedState;
}

/** Team color as raw hex, or null when the map falls back to a CSS token. */
function teamHex(teamId: number): string | null {
  const bg = getTeamColor(teamId).bg;
  return bg.startsWith('#') ? bg : null;
}

const NEUTRAL_HEX = '#64748b';

export function GameCard({ game }: { game: ScheduleGame }) {
  const isLive = game.status.abstractGameState === 'Live';
  const isFinal = game.status.abstractGameState === 'Final';
  const showScore = isLive || isFinal;

  const awayHex = teamHex(game.away.id) ?? NEUTRAL_HEX;
  const homeHex = teamHex(game.home.id) ?? NEUTRAL_HEX;
  // Subtle two-team wash: away color from the top-left, home from the
  // bottom-right, fading to the panel surface in the middle ("14" = ~8% alpha).
  const cardStyle = {
    background: `linear-gradient(135deg, ${awayHex}14 0%, rgba(255,255,255,0) 42%, rgba(255,255,255,0) 58%, ${homeHex}14 100%), var(--panel-bg)`,
  };

  return (
    <Link to={`/game/${game.gamePk}`} className={`game-card${isLive ? ' game-card-live' : ''}`} style={cardStyle}>
      <div className="game-card-status">
        {isLive && <span className="live-dot" />}
        {statusLabel(game)}
        {!showScore && <span className="game-card-time">{formatGameTime(game.gameDate)}</span>}
      </div>
      <div className="game-card-team">
        <span className="game-card-team-name">
          <span className="team-chip" style={{ background: awayHex }} />
          {game.away.name}
        </span>
        {showScore && <span className="game-card-team-score">{game.away.score ?? 0}</span>}
      </div>
      <div className="game-card-team">
        <span className="game-card-team-name">
          <span className="team-chip" style={{ background: homeHex }} />
          {game.home.name}
        </span>
        {showScore && <span className="game-card-team-score">{game.home.score ?? 0}</span>}
      </div>
      {game.venue && <div className="game-card-venue">{game.venue}</div>}
      {showScore && game.linescore && game.linescore.length > 0 && (
        <div className="game-card-linescore">
          <div className="game-card-linescore-row">
            <span className="game-card-linescore-abbr">{game.away.abbreviation}</span>
            {game.linescore.map(({ num, away }) => (
              <span key={num} className="game-card-linescore-cell">{away ?? ''}</span>
            ))}
            <span className="game-card-linescore-total">{game.away.score ?? ''}</span>
          </div>
          <div className="game-card-linescore-row">
            <span className="game-card-linescore-abbr">{game.home.abbreviation}</span>
            {game.linescore.map(({ num, home }) => (
              <span key={num} className="game-card-linescore-cell">{home ?? ''}</span>
            ))}
            <span className="game-card-linescore-total">{game.home.score ?? ''}</span>
          </div>
        </div>
      )}
    </Link>
  );
}
