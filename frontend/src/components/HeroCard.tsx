import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DailyStarsResponse, GamePreviewResponse, Scorecard, ScheduleGame } from '@mlb-scorecards/shared';
import { fetchGamePreview } from '../api/client';
import { getSocket } from '../api/socket';
import { dramaReason, type HeroPick } from '../lib/gameSignals';
import { getTeamHex } from '../teamColors';
import { BasesMini } from './BasesMini';

const NEUTRAL_HEX = '#64748b';

function heroStyle(awayId: number, homeId: number) {
  const a = getTeamHex(awayId) ?? NEUTRAL_HEX;
  const h = getTeamHex(homeId) ?? NEUTRAL_HEX;
  return {
    background: `linear-gradient(120deg, ${a}33 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, ${h}33 100%), var(--panel-bg)`,
  };
}

function LiveHero({ game }: { game: ScheduleGame }) {
  // The schedule poll refreshes every 30s; ride the game-room socket for
  // 5-second freshness on the one game we're featuring.
  const [sc, setSc] = useState<Scorecard | null>(null);

  useEffect(() => {
    setSc(null);
    const socket = getSocket();
    const onScorecard = (payload: Scorecard) => {
      if (payload.gamePk === game.gamePk) setSc(payload);
    };
    socket.on('scorecard', onScorecard);
    socket.emit('subscribe', game.gamePk);
    return () => {
      socket.emit('unsubscribe');
      socket.off('scorecard', onScorecard);
    };
  }, [game.gamePk]);

  const awayScore = sc?.totals.away.r ?? game.away.score ?? 0;
  const homeScore = sc?.totals.home.r ?? game.home.score ?? 0;
  const inning = sc?.inning ?? game.inning;
  const half = sc ? (sc.halfInning === 'top' ? 'Top' : 'Bottom') : game.inningState;
  const outs = sc?.outs ?? game.situation?.outs ?? 0;
  const bases = sc?.bases ?? {
    first: game.situation?.onFirst ?? false,
    second: game.situation?.onSecond ?? false,
    third: game.situation?.onThird ?? false,
  };
  const reason = dramaReason(game);

  return (
    <Link to={`/game/${game.gamePk}`} className="hero-card" style={heroStyle(game.away.id, game.home.id)}>
      <div className="hero-status">
        <span className="live-dot" /> LIVE · {half} {inning}
        {reason && <span className="hero-reason">{reason}</span>}
      </div>
      <div className="hero-matchup">
        <span className="hero-team">
          {game.away.name} <strong className="hero-score">{awayScore}</strong>
        </span>
        <span className="hero-at">@</span>
        <span className="hero-team">
          {game.home.name} <strong className="hero-score">{homeScore}</strong>
        </span>
      </div>
      <div className="hero-situation">
        <BasesMini first={bases.first} second={bases.second} third={bases.third} outs={outs} />
        {sc && (
          <span className="hero-count">
            {sc.balls}-{sc.strikes}
          </span>
        )}
        {game.situation?.batter && game.situation?.pitcher && (
          <span className="hero-batters">
            {game.situation.batter} <span className="atbat-vs">vs</span> {game.situation.pitcher}
          </span>
        )}
      </div>
      <span className="hero-cta">Open the live scorecard ›</span>
    </Link>
  );
}

function UpcomingHero({ game }: { game: ScheduleGame }) {
  const [preview, setPreview] = useState<GamePreviewResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    fetchGamePreview(game.gamePk)
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [game.gamePk]);

  const probableLine = (side: 'away' | 'home') => {
    const p = preview?.[side]?.probable;
    const name = game[side].probablePitcher ?? p?.name;
    if (!name) return null;
    const span = p?.span;
    return (
      <span className="hero-probable">
        <strong>{name}</strong>
        {p?.hand && ` (${p.hand}HP)`}
        {span && ` — ${span.era.toFixed(2)} ERA last ${p!.starts.length}`}
      </span>
    );
  };

  return (
    <Link to={`/game/${game.gamePk}`} className="hero-card" style={heroStyle(game.away.id, game.home.id)}>
      <div className="hero-status">
        NEXT UP ·{' '}
        {new Date(game.gameDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
      <div className="hero-matchup">
        <span className="hero-team">{game.away.name}</span>
        <span className="hero-at">@</span>
        <span className="hero-team">{game.home.name}</span>
      </div>
      <div className="hero-probables">
        {probableLine('away')}
        {probableLine('away') && probableLine('home') && <span className="atbat-vs"> vs </span>}
        {probableLine('home')}
      </div>
      <span className="hero-cta">See the pre-game breakdown ›</span>
    </Link>
  );
}

function ReplayHero({
  pick,
  spoilerSafe,
}: {
  pick: NonNullable<DailyStarsResponse['replayPick']>;
  spoilerSafe: boolean;
}) {
  return (
    <Link to={`/game/${pick.gamePk}`} className="hero-card hero-card-replay">
      <div className="hero-status">WORTH A REPLAY · yesterday</div>
      <div className="hero-matchup">
        <span className="hero-team">
          {pick.awayAbbr} {!spoilerSafe && <strong className="hero-score">{pick.awayScore}</strong>}
        </span>
        <span className="hero-at">@</span>
        <span className="hero-team">
          {pick.homeAbbr} {!spoilerSafe && <strong className="hero-score">{pick.homeScore}</strong>}
        </span>
      </div>
      <div className="hero-reason-line">{spoilerSafe ? 'A finish worth watching unspoiled' : pick.reason}</div>
      <span className="hero-cta">Replay it at-bat by at-bat ›</span>
    </Link>
  );
}

export function HeroCard({
  hero,
  spoilerSafe,
}: {
  hero: HeroPick;
  spoilerSafe: boolean;
}) {
  if (hero.kind === 'live') return <LiveHero game={hero.game} />;
  if (hero.kind === 'upcoming') return <UpcomingHero game={hero.game} />;
  return <ReplayHero pick={hero.pick} spoilerSafe={spoilerSafe} />;
}
