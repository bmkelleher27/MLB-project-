import { useEffect, useState } from 'react';
import type { ScheduleGame } from '@mlb-scorecards/shared';
import { fetchSchedule } from '../api/client';
import { DatePicker } from '../components/DatePicker';
import { GameCard } from '../components/GameCard';
import { todayIso } from '../lib/date';

const POLL_INTERVAL_MS = 30_000;

export function LandingPage() {
  const [date, setDate] = useState(todayIso());
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1>MLB Live Scorecards</h1>
      </header>
      <DatePicker date={date} onChange={setDate} />
      {loading && games.length === 0 && <p className="status-message">Loading games...</p>}
      {error && <p className="status-message status-error">{error}</p>}
      {!loading && !error && games.length === 0 && <p className="status-message">No games scheduled.</p>}
      <div className="game-grid">
        {games.map((game) => (
          <GameCard key={game.gamePk} game={game} />
        ))}
      </div>
    </div>
  );
}
