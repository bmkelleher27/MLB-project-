import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ScheduleGame } from '@mlb-scorecards/shared';
import { formatGameTime } from '../lib/date';
import { gameBadges } from '../lib/gameSignals';
import { getTeamHex } from '../teamColors';
import { BasesMini } from './BasesMini';
import { TeamLogo } from './TeamLogo';

function statusLabel(game: ScheduleGame): string {
  if (game.status.abstractGameState === 'Live') {
    const half = game.inningState ?? '';
    return game.inning ? `${half} ${game.inning}` : 'Live';
  }
  return game.status.detailedState;
}

const NEUTRAL_HEX = '#64748b';

/** "Yandy Díaz" → "Y. Díaz" so the matchup line fits a card. */
function shortName(full: string): string {
  const parts = full.split(' ');
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

interface GameCardProps {
  game: ScheduleGame;
  favoriteTeamIds?: number[];
  onToggleFavorite?: (teamId: number) => void;
  spoilerSafe?: boolean;
}

export function GameCard({ game, favoriteTeamIds = [], onToggleFavorite, spoilerSafe = false }: GameCardProps) {
  const isLive = game.status.abstractGameState === 'Live';
  const isFinal = game.status.abstractGameState === 'Final';
  const [revealed, setRevealed] = useState(false);
  const masked = spoilerSafe && isFinal && !revealed;
  const showScore = (isLive || isFinal) && !masked;

  const awayHex = getTeamHex(game.away.id) ?? NEUTRAL_HEX;
  const homeHex = getTeamHex(game.home.id) ?? NEUTRAL_HEX;
  // Two-team wash: away color from the top-left, home from the
  // bottom-right, fading to the panel surface in the middle ("2b" = ~17% alpha).
  const cardStyle = {
    background: `linear-gradient(135deg, ${awayHex}52 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, ${homeHex}52 100%), var(--panel-bg)`,
  };

  const badges = gameBadges(game).filter((b) => !(masked && b.spoils));

  function star(teamId: number) {
    if (!onToggleFavorite) return null;
    const isFav = favoriteTeamIds.includes(teamId);
    return (
      <button
        className={`fav-star${isFav ? ' fav-star-on' : ''}`}
        title={isFav ? 'Remove favorite team' : 'Add favorite team'}
        aria-label={isFav ? 'Remove favorite team' : 'Add favorite team'}
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
          <TeamLogo teamId={team.id} imgClassName="team-logo" fallbackClassName="team-chip" />
          {team.name}
          {star(team.id)}
        </span>
        {showScore && <span className="game-card-team-score">{team.score ?? 0}</span>}
        {!isLive && !isFinal && team.probablePitcher && (
          <span className="game-card-probable" title="Probable pitcher">{team.probablePitcher}</span>
        )}
      </div>
    );
  }

  return (
    <Link to={`/game/${game.gamePk}`} className={`game-card${isLive ? ' game-card-live' : ''}`} style={cardStyle}>
      <div className="game-card-status">
        {isLive && <span className="live-dot" />}
        {masked ? 'Final' : statusLabel(game)}
        {!isLive && !isFinal && <span className="game-card-time">{formatGameTime(game.gameDate)}</span>}
        {badges.map((b) => (
          <span key={b.key} className={`game-badge ${b.className}`}>{b.label}</span>
        ))}
      </div>
      {teamRow('away')}
      {teamRow('home')}
      {isLive && game.situation && (
        <div className="game-card-situation">
          <BasesMini
            first={game.situation.onFirst}
            second={game.situation.onSecond}
            third={game.situation.onThird}
            outs={game.situation.outs}
          />
          {game.situation.batter && game.situation.pitcher && (
            <span className="game-card-matchup">
              {shortName(game.situation.batter)} <span className="atbat-vs">vs</span>{' '}
              {shortName(game.situation.pitcher)}
            </span>
          )}
        </div>
      )}
      {masked && (
        <button
          className="spoiler-reveal"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed(true);
          }}
        >
          Tap to reveal score
        </button>
      )}
      {game.venue && !masked && <div className="game-card-venue">{game.venue}</div>}
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
