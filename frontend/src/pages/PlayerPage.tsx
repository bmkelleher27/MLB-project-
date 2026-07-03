import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PlayerLogResponse } from '@mlb-scorecards/shared';
import { fetchPlayerLog } from '../api/client';

const FIRST_SEASON = 2010;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const season = parseInt(params.get('season') ?? String(currentYear), 10);
  const seasons = useMemo(
    () => Array.from({ length: currentYear - FIRST_SEASON + 1 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const [log, setLog] = useState<PlayerLogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlayerLog(Number(id), season)
      .then((r) => {
        if (!cancelled) setLog(r);
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
  }, [id, season]);

  const goToGame = (gamePk: number | null) => {
    if (gamePk) navigate(`/game/${gamePk}`);
  };

  return (
    <>
      <div className="scorecard-nav-bar">
        <Link to="/" className="scorecard-nav-back">‹ Schedule</Link>
        <span className="scorecard-nav-date">Player game log</span>
      </div>
      <div className="player-page">
        <div className="player-header">
          <h1>
            {log?.name ?? 'Player'}
            {log?.position && <span className="player-header-pos">{log.position}</span>}
          </h1>
          <label className="season-control">
            Season
            <select
              value={season}
              onChange={(e) => {
                const p = new URLSearchParams(params);
                p.set('season', e.target.value);
                setParams(p, { replace: true });
              }}
            >
              {seasons.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="status-message status-error">{error}</p>}
        {loading && <p className="status-message">Loading game log…</p>}
        {!loading && log && log.batting.length === 0 && log.pitching.length === 0 && (
          <p className="status-message">No games for {log.name} in {season}.</p>
        )}

        {!loading && log && log.batting.length > 0 && (
          <section>
            <h2 className="player-section-title">Batting — {season} ({log.batting.length} games)</h2>
            <div className="player-log-wrapper">
              <table className="predictive-table player-log-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="predictive-col-name">Opponent</th>
                    <th>AB</th>
                    <th>H</th>
                    <th>HR</th>
                    <th>RBI</th>
                    <th>BB</th>
                    <th>K</th>
                    <th title="Season batting average through this game">AVG</th>
                  </tr>
                </thead>
                <tbody>
                  {log.batting.map((g, i) => (
                    <tr
                      key={`${g.date}-${g.gamePk ?? i}`}
                      className={g.gamePk ? 'player-log-row' : undefined}
                      onClick={() => goToGame(g.gamePk)}
                      title={g.gamePk ? 'Open this game’s scorecard' : undefined}
                    >
                      <td>{formatDate(g.date)}</td>
                      <td className="predictive-col-name">{g.isHome ? 'vs' : '@'} {g.opponent}</td>
                      <td>{g.atBats}</td>
                      <td>{g.hits}</td>
                      <td>{g.homeRuns || ''}</td>
                      <td>{g.rbi || ''}</td>
                      <td>{g.walks || ''}</td>
                      <td>{g.strikeouts || ''}</td>
                      <td>{g.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && log && log.pitching.length > 0 && (
          <section>
            <h2 className="player-section-title">Pitching — {season} ({log.pitching.length} games)</h2>
            <div className="player-log-wrapper">
              <table className="predictive-table player-log-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="predictive-col-name">Opponent</th>
                    <th>IP</th>
                    <th>H</th>
                    <th>ER</th>
                    <th>BB</th>
                    <th>K</th>
                  </tr>
                </thead>
                <tbody>
                  {log.pitching.map((g, i) => (
                    <tr
                      key={`${g.date}-${g.gamePk ?? i}`}
                      className={g.gamePk ? 'player-log-row' : undefined}
                      onClick={() => goToGame(g.gamePk)}
                      title={g.gamePk ? 'Open this game’s scorecard' : undefined}
                    >
                      <td>{formatDate(g.date)}</td>
                      <td className="predictive-col-name">{g.isHome ? 'vs' : '@'} {g.opponent}</td>
                      <td>{g.inningsPitched}</td>
                      <td>{g.hits}</td>
                      <td>{g.earnedRuns}</td>
                      <td>{g.walks}</td>
                      <td>{g.strikeouts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="player-page-note">Click a row to open that game's scorecard.</p>
      </div>
    </>
  );
}
