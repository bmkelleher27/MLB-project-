import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SeasonGame, TeamInfo } from '@mlb-scorecards/shared';
import { fetchSeason, fetchTeams } from '../api/client';
import { getTeamColor } from '../teamColors';

const FIRST_SEASON = 2010;

const GAME_TYPE_LABELS: Record<string, string> = {
  F: 'Wild Card',
  D: 'Division Series',
  L: 'LCS',
  W: 'World Series',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function monthKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function SeasonPage() {
  const currentYear = new Date().getFullYear();
  const seasons = useMemo(
    () => Array.from({ length: currentYear - FIRST_SEASON + 1 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const [params, setParams] = useSearchParams();
  const season = parseInt(params.get('season') ?? String(currentYear), 10);
  const teamId = params.get('team') ? parseInt(params.get('team')!, 10) : null;

  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [games, setGames] = useState<SeasonGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTeams(season)
      .then((t) => {
        if (!cancelled) setTeams(t);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [season]);

  useEffect(() => {
    if (teamId == null) {
      setGames(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSeason(teamId, season)
      .then((r) => {
        if (!cancelled) setGames(r.games);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, season]);

  function update(next: { season?: number; team?: number | null }) {
    const p = new URLSearchParams(params);
    if (next.season !== undefined) p.set('season', String(next.season));
    if (next.team !== undefined) {
      if (next.team === null) p.delete('team');
      else p.set('team', String(next.team));
    }
    setParams(p, { replace: true });
  }

  const team = teams.find((t) => t.id === teamId) ?? null;
  const teamHexRaw = teamId != null ? getTeamColor(teamId).bg : null;
  const teamHex = teamHexRaw?.startsWith('#') ? teamHexRaw : null;

  const record = useMemo(() => {
    if (!games) return null;
    let w = 0;
    let l = 0;
    for (const g of games) {
      if (g.won === true) w++;
      else if (g.won === false) l++;
    }
    return { w, l };
  }, [games]);

  const byMonth = useMemo(() => {
    if (!games) return [];
    const map = new Map<string, SeasonGame[]>();
    for (const g of games) {
      const key = monthKey(g.gameDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return [...map.entries()];
  }, [games]);

  return (
    <>
      <div className="scorecard-nav-bar">
        <Link to="/" className="scorecard-nav-back">‹ Schedule</Link>
        <span className="scorecard-nav-date">Season review</span>
      </div>
      <div className="season-page">
        <h1>Season Review</h1>
        <div className="season-controls">
          <label className="season-control">
            Season
            <select value={season} onChange={(e) => update({ season: Number(e.target.value) })}>
              {seasons.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="season-control">
            Team
            <select
              value={teamId ?? ''}
              onChange={(e) => update({ team: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Choose a team…</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="status-message status-error">{error}</p>}
        {!teamId && !error && <p className="status-message">Pick a team to see every game of its {season} season.</p>}
        {loading && <p className="status-message">Loading season…</p>}

        {team && games && !loading && (
          <>
            <div className="season-summary" style={teamHex ? { borderLeft: `4px solid ${teamHex}` } : undefined}>
              <span className="season-summary-team">{team.name} · {season}</span>
              {record && (
                <span className="season-summary-record">
                  {record.w}–{record.l}
                </span>
              )}
              <span className="season-summary-count">{games.length} games</span>
            </div>
            {byMonth.map(([month, monthGames]) => (
              <section key={month} className="season-month">
                <h2 className="season-month-title">{month}</h2>
                <div className="season-games">
                  {monthGames.map((g) => {
                    const isFinal = g.status.abstractGameState === 'Final';
                    const postseason = GAME_TYPE_LABELS[g.gameType];
                    return (
                      <Link key={g.gamePk} to={`/game/${g.gamePk}`} className="season-game-row">
                        <span className="season-game-date">{formatDate(g.gameDate)}</span>
                        <span className="season-game-opp">
                          <span className="season-game-ha">{g.isHome ? 'vs' : '@'}</span> {g.opponent.name}
                        </span>
                        {postseason && <span className="season-game-type">{postseason}</span>}
                        {isFinal && g.won != null ? (
                          <span className={`season-game-result ${g.won ? 'season-win' : 'season-loss'}`}>
                            {g.won ? 'W' : 'L'} {g.teamScore}–{g.opponentScore}
                          </span>
                        ) : (
                          <span className="season-game-status">{g.status.detailedState}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}
