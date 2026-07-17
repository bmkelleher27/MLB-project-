import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DailyStarsResponse, ScheduleGame } from '@mlb-scorecards/shared';
import { fetchDailyStars, fetchRandomGame, fetchSchedule } from '../api/client';
import { DailyStarsStrip } from '../components/DailyStarsStrip';
import { DatePicker } from '../components/DatePicker';
import { GameCard } from '../components/GameCard';
import { HeroCard } from '../components/HeroCard';
import { LogoMark } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { addDays, todayIso } from '../lib/date';
import { getFavoriteTeams, toggleFavoriteTeam } from '../lib/favorite';
import { drama, getSpoilerSafe, pickHero, setSpoilerSafe } from '../lib/gameSignals';

const POLL_INTERVAL_MS = 30_000;

function involvesAny(game: ScheduleGame, teamIds: number[]): boolean {
  return teamIds.includes(game.away.id) || teamIds.includes(game.home.id);
}

export function LandingPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [randomLoading, setRandomLoading] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(getFavoriteTeams);
  const [spoilerSafe, setSpoilerSafeState] = useState<boolean>(getSpoilerSafe);
  const [stars, setStars] = useState<DailyStarsResponse | null>(null);

  const isToday = date === todayIso();

  function toggleFavorite(teamId: number) {
    setFavorites(toggleFavoriteTeam(teamId));
  }

  function toggleSpoilerSafe() {
    setSpoilerSafeState((prev) => {
      setSpoilerSafe(!prev);
      return !prev;
    });
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

  // Yesterday's stars only decorate the "today" dashboard view.
  useEffect(() => {
    if (!isToday) {
      setStars(null);
      return;
    }
    let cancelled = false;
    fetchDailyStars(addDays(todayIso(), -1))
      .then((s) => {
        if (!cancelled) setStars(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isToday]);

  const hero = useMemo(
    () => (isToday ? pickHero(games, favorites, stars) : null),
    [isToday, games, favorites, stars]
  );

  const groups = useMemo(() => {
    // Favorites always pin first; live games then sort by watchability so a
    // close-and-late game outranks a blowout.
    const favFirst = (list: ScheduleGame[], key: (g: ScheduleGame) => number = () => 0) =>
      [...list].sort(
        (a, b) =>
          Number(involvesAny(b, favorites)) - Number(involvesAny(a, favorites)) || key(b) - key(a)
      );
    const live = games.filter((g) => g.status.abstractGameState === 'Live');
    const upcoming = games
      .filter((g) => g.status.abstractGameState !== 'Live' && g.status.abstractGameState !== 'Final')
      .sort((a, b) => a.gameDate.localeCompare(b.gameDate));
    const finals = games.filter((g) => g.status.abstractGameState === 'Final');
    return [
      { title: 'Live', games: favFirst(live, drama) },
      { title: 'Upcoming', games: favFirst(upcoming) },
      { title: 'Final', games: favFirst(finals) },
    ].filter((s) => s.games.length > 0);
  }, [games, favorites]);

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
          <button
            className={`random-game-btn${spoilerSafe ? ' spoiler-btn-on' : ''}`}
            onClick={toggleSpoilerSafe}
            title="Hide final scores until you reveal them — for games you recorded"
            aria-pressed={spoilerSafe}
          >
            {spoilerSafe ? '🙈 Spoilers hidden' : '👁 Hide final scores'}
          </button>
        </div>
      </div>
      {hero && <HeroCard hero={hero} spoilerSafe={spoilerSafe} />}
      {isToday && stars && !spoilerSafe && <DailyStarsStrip stars={stars} />}
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
                favoriteTeamIds={favorites}
                onToggleFavorite={toggleFavorite}
                spoilerSafe={spoilerSafe}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
