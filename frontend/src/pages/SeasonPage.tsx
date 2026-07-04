import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { SeasonGame, SeasonPredictiveResponse, TeamInfo } from '@mlb-scorecards/shared';
import { fetchSeason, fetchSeasonPredictive, fetchTeams } from '../api/client';
import { formatMonthYear, formatWeekdayDate, seasonList } from '../lib/date';
import { getFavoriteTeam } from '../lib/favorite';
import { getTeamHex } from '../teamColors';

const GAME_TYPE_LABELS: Record<string, string> = {
  F: 'Wild Card',
  D: 'Division Series',
  L: 'LCS',
  W: 'World Series',
};

export function SeasonPage() {
  const currentYear = new Date().getFullYear();
  const seasons = seasonList();

  const [params, setParams] = useSearchParams();
  const season = parseInt(params.get('season') ?? String(currentYear), 10);
  const teamId = params.get('team') ? parseInt(params.get('team')!, 10) : null;

  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [games, setGames] = useState<SeasonGame[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaders, setLeaders] = useState<SeasonPredictiveResponse | null>(null);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leadersError, setLeadersError] = useState<string | null>(null);
  const favoriteAppliedRef = useRef(false);

  // Default to the favorite team on first visit (only when no team is in the URL).
  useEffect(() => {
    if (favoriteAppliedRef.current) return;
    favoriteAppliedRef.current = true;
    if (params.get('team')) return;
    const fav = getFavoriteTeam();
    if (fav === null) return;
    const p = new URLSearchParams(params);
    p.set('team', String(fav));
    setParams(p, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new team/season selection invalidates any computed leaderboard.
  useEffect(() => {
    setLeaders(null);
    setLeadersError(null);
  }, [teamId, season]);

  async function loadLeaders() {
    if (teamId == null) return;
    setLeadersLoading(true);
    setLeadersError(null);
    try {
      setLeaders(await fetchSeasonPredictive(teamId, season));
    } catch (err) {
      setLeadersError((err as Error).message);
    } finally {
      setLeadersLoading(false);
    }
  }

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
  const teamHex = teamId != null ? getTeamHex(teamId) : null;

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
      const key = formatMonthYear(g.gameDate);
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
            <div className="season-strip" aria-label="Season results, one tick per game">
              {games.map((g) => (
                <Link
                  key={g.gamePk}
                  to={`/game/${g.gamePk}`}
                  className={`season-tick${g.won === true ? ' season-tick-w' : g.won === false ? ' season-tick-l' : ''}`}
                  title={`${formatWeekdayDate(g.gameDate)} ${g.isHome ? 'vs' : '@'} ${g.opponent.abbreviation}${
                    g.won != null ? ` — ${g.won ? 'W' : 'L'} ${g.teamScore}-${g.opponentScore}` : ''
                  }`}
                />
              ))}
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
                        <span className="season-game-date">{formatWeekdayDate(g.gameDate)}</span>
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
            <section className="season-leaders">
              <h2 className="season-month-title">Season DMG / DOM leaders</h2>
              {!leaders && !leadersLoading && (
                <div className="replay-bar replay-bar-idle">
                  <button className="replay-btn replay-start" onClick={loadLeaders}>
                    ⚡ Compute predictive leaders
                  </button>
                  <span className="replay-hint">
                    Aggregates every game of the season — the first run for a team can take a minute
                  </span>
                </div>
              )}
              {leadersLoading && <p className="status-message">Crunching {games.length} games…</p>}
              {leadersError && <p className="status-message status-error">{leadersError}</p>}
              {leaders && <SeasonLeaders leaders={leaders} />}
            </section>
          </>
        )}
      </div>
    </>
  );
}

const MIN_PA = 50;
const MIN_PITCHES = 200;
const TOP_N = 10;

function SeasonLeaders({ leaders }: { leaders: SeasonPredictiveResponse }) {
  const batters = leaders.batters.filter((b) => b.pa >= MIN_PA).slice(0, TOP_N);
  const pitchers = leaders.pitchers.filter((p) => p.pitches >= MIN_PITCHES).slice(0, TOP_N);
  const hasEV = batters.some((b) => b.avgEV != null);
  return (
    <div className="predictive-stats">
      <div className="predictive-tables">
        {batters.length > 0 && (
          <table className="predictive-table">
            <thead>
              <tr>
                <th className="predictive-col-name">Batter (min {MIN_PA} PA)</th>
                <th>PA</th>
                <th>BB</th>
                <th>K</th>
                {hasEV && <th title="Barrels">Brl</th>}
                {hasEV && <th title="Hard-hit balls (95+ mph)">Hard</th>}
                {hasEV && <th title="Average exit velocity">EV</th>}
                <th title="Damage Index, 100 = league average">DMG</th>
              </tr>
            </thead>
            <tbody>
              {batters.map((b) => (
                <tr key={b.id}>
                  <td className="predictive-col-name">
                    <Link to={`/player/${b.id}?season=${leaders.season}`} className="player-link">{b.name}</Link>
                  </td>
                  <td>{b.pa}</td>
                  <td>{b.walks}</td>
                  <td>{b.strikeouts}</td>
                  {hasEV && <td>{b.barrels || ''}</td>}
                  {hasEV && <td>{b.hardHit || ''}</td>}
                  {hasEV && <td>{b.avgEV ?? ''}</td>}
                  <td className="predictive-index">{b.dmg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pitchers.length > 0 && (
          <table className="predictive-table">
            <thead>
              <tr>
                <th className="predictive-col-name">Pitcher (min {MIN_PITCHES} pitches)</th>
                <th>P</th>
                <th>CSW%</th>
                {hasEV && <th title="Hard-hit balls allowed">Hard</th>}
                {hasEV && <th title="Average exit velocity allowed">EV</th>}
                <th title="Dominance Index, 100 = league average">DOM</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => (
                <tr key={p.id}>
                  <td className="predictive-col-name">
                    <Link to={`/player/${p.id}?season=${leaders.season}`} className="player-link">{p.name}</Link>
                  </td>
                  <td>{p.pitches}</td>
                  <td>{(p.csw * 100).toFixed(1)}</td>
                  {hasEV && <td>{p.hardHitAllowed}</td>}
                  {hasEV && <td>{p.avgEVAllowed ?? ''}</td>}
                  <td className="predictive-index">{p.dom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="predictive-footnote">
        Aggregated from {leaders.gamesProcessed} games. 100 = league average.{' '}
        <Link to="/stats">How the formulas work →</Link>
      </p>
    </div>
  );
}
