import { useState } from 'react';
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

function TeamMark({ teamId }: { teamId: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="team-chip" style={{ background: teamHex(teamId) ?? NEUTRAL_HEX }} />;
  }
  return (
    <img
      className="team-logo"
      src={`https://www.mlbstatic.com/team-logos/${teamId}.svg`}
      alt=""
      loading="lazy"
      width={20}
      height={20}
      onError={() => setFailed(true)}
    />
  );
}

interface GameCardProps {
  game: ScheduleGame;
  favoriteTeamId?: number | null;
  onToggleFavorite?: (teamId: number) => void;
}

export function GameCard({ game, favoriteTeamId = null, onToggleFavorite }: GameCardProps) {
  const isLive = game.status.abstractGameState === 'Live';
  const isFinal = game.status.abstractGameState === 'Final';
  const showScore = isLive || isFinal;

  const awayHex = teamHex(game.away.id) ?? NEUTRAL_HEX;
  const homeHex = teamHex(game.home.id) ?? NEUTRAL_HEX;
  // Two-team wash: away color from the top-left, home from the
  // bottom-right, fading to the panel surface in the middle ("2b" = ~17% alpha).
  const cardStyle = {
    background: `linear-gradient(135deg, ${awayHex}2b 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0) 55%, ${homeHex}2b 100%), var(--panel-bg)`,
  };

  function star(teamId: number) {
    if (!onToggleFavorite) return null;
    const isFav = favoriteTeamId === teamId;
    return (
      <button
        className={`fav-star${isFav ? ' fav-star-on' : ''}`}
        title={isFav ? 'Remove favorite team' : 'Set as favorite team'}
        aria-label={isFav ? 'Remove favorite team' : 'Set as favorite team'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite(teamId);
        }}
      >
        {isFav ? '★' : '☆'}
      </button>
    );
  }

  function teamRow(side: 'away' | 'home') {
    const team = game[side];
    return (
      <div className="game-card-team">
        <span className="game-card-team-name">
          <TeamMark teamId={team.id} />
          {team.name}
          {star(team.id)}
        </span>
        {showScore && <span className="game-card-team-score">{team.score ?? 0}</span>}
        {!showScore && team.probablePitcher && (
          <span className="game-card-probable" title="Probable pitcher">{team.probablePitcher}</span>
        )}
      </div>
    );
  }

  return (
    <Link to={`/game/${game.gamePk}`} className={`game-card${isLive ? ' game-card-live' : ''}`} style={cardStyle}>
      <div className="game-card-status">
        {isLive && <span className="live-dot" />}
        {statusLabel(game)}
        {!showScore && <span className="game-card-time">{formatGameTime(game.gameDate)}</span>}
      </div>
      {teamRow('away')}
      {teamRow('home')}
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
