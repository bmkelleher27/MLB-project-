import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ScheduleGame } from '@mlb-scorecards/shared';
import { fetchSchedule, fetchRandomGame } from '../api/client';
import { DatePicker } from '../components/DatePicker';
import { GameCard } from '../components/GameCard';
import { LogoMark } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { getFavoriteTeam, setFavoriteTeam } from '../lib/favorite';
import { todayIso } from '../lib/date';

const POLL_INTERVAL_MS = 30_000;

function involvesTeam(game: ScheduleGame, teamId: number | null): boolean {
  return teamId !== null && (game.away.id === teamId || game.home.id === teamId);
}

export function LandingPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [randomLoading, setRandomLoading] = useState(false);
  const [favorite, setFavorite] = useState<number | null>(getFavoriteTeam);

  function toggleFavorite(teamId: number) {
    const next = favorite === teamId ? null : teamId;
    setFavorite(next);
    setFavoriteTeam(next);
  }

  async function goToRandomGame() {
    setRandomLoading(true);
    try {
      const { gamePk } = await fetchRandomGame();
      navigate(`/game/${gamePk}`);
    } catch {
      // silently fail — button just resets
    } finally {
      setRandomLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const data = await fetchSchedule(date);
        if (!cancelled) setGames(data.games);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [date]);

  const groups = useMemo(() => {
    const favFirst = (list: ScheduleGame[]) =>
      [...list].sort((a, b) => Number(involvesTeam(b, favorite)) - Number(involvesTeam(a, favorite)));
    const live = games.filter((g) => g.status.abstractGameState === 'Live');
    const upcoming = games
      .filter((g) => g.status.abstractGameState !== 'Live' && g.status.abstractGameState !== 'Final')
      .sort((a, b) => a.gameDate.localeCompare(b.gameDate));
    const finals = games.filter((g) => g.status.abstractGameState === 'Final');
    return [
      { title: 'Live', games: favFirst(live) },
      { title: 'Upcoming', games: favFirst(upcoming) },
      { title: 'Final', games: favFirst(finals) },
    ].filter((s) => s.games.length > 0);
  }, [games, favorite]);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-header-bar">
          <h1 className="landing-title">
            <LogoMark size={34} />
            MLB Live Scorecards
          </h1>
          <ThemeToggle />
        </div>
      </header>
      <div className="landing-toolbar">
        <DatePicker date={date} onChange={setDate} />
        <div className="landing-actions">
          <button
            className="random-game-btn"
            onClick={goToRandomGame}
            disabled={randomLoading}
          >
            {randomLoading ? 'Finding a game…' : '⚄ Random Historical Game'}
          </button>
          <Link to="/season" className="random-game-btn">📅 Season Review</Link>
        </div>
      </div>
      {loading && games.length === 0 && (
        <div className="game-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton skeleton-game-card" />
          ))}
        </div>
      )}
      {error && <p className="status-message status-error">{error}</p>}
      {!loading && !error && games.length === 0 && <p className="status-message">No games scheduled.</p>}
      {groups.map((section) => (
        <section key={section.title} className="landing-section">
          {groups.length > 1 && <h2 className="landing-section-title">{section.title}</h2>}
          <div className="game-grid">
            {section.games.map((game) => (
              <GameCard
                key={game.gamePk}
                game={game}
                favoriteTeamId={favorite}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
