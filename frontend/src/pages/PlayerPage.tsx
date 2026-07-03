import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PlayerLogResponse, PlayerPredictiveResponse } from '@mlb-scorecards/shared';
import { fetchPlayerLog, fetchPlayerPredictive } from '../api/client';

const FIRST_SEASON = 2010;

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function indexClass(value: number): string {
  if (value >= 130) return ' pred-index-high';
  if (value <= 70) return ' pred-index-low';
  return '';
}

function StatTile({ label, value, title }: { label: string; value: string | number; title?: string }) {
  return (
    <div className="stat-tile" title={title}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
    </div>
  );
}

function SeasonTotals({ log }: { log: PlayerLogResponse }) {
  const bat = log.seasonBatting;
  const pit = log.seasonPitching;
  if (!bat && !pit) return null;
  return (
    <div className="player-season-stats">
      {bat && (
        <div className="stat-tile-row">
          <span className="stat-tile-row-label">Batting</span>
          <StatTile label="G" value={bat.games} title="Games played" />
          <StatTile label="AVG" value={bat.avg} title="Batting average" />
          <StatTile label="OBP" value={bat.obp} title="On-base percentage" />
          <StatTile label="SLG" value={bat.slg} title="Slugging percentage" />
          <StatTile label="OPS" value={bat.ops} title="On-base plus slugging" />
          <StatTile label="HR" value={bat.homeRuns} title="Home runs" />
          <StatTile label="RBI" value={bat.rbi} title="Runs batted in" />
          <StatTile label="R" value={bat.runs} title="Runs scored" />
          <StatTile label="BB" value={bat.walks} title="Walks" />
          <StatTile label="K" value={bat.strikeouts} title="Strikeouts" />
          <StatTile label="SB" value={bat.stolenBases} title="Stolen bases" />
        </div>
      )}
      {pit && (
        <div className="stat-tile-row">
          <span className="stat-tile-row-label">Pitching</span>
          <StatTile label="W–L" value={`${pit.wins}–${pit.losses}`} title="Wins and losses" />
          <StatTile label="ERA" value={pit.era} title="Earned run average" />
          <StatTile label="WHIP" value={pit.whip} title="Walks + hits per inning" />
          <StatTile label="IP" value={pit.inningsPitched} title="Innings pitched" />
          <StatTile
            label="G"
            value={pit.gamesStarted > 0 ? `${pit.games} (${pit.gamesStarted} GS)` : pit.games}
            title="Games (games started)"
          />
          <StatTile label="K" value={pit.strikeouts} title="Strikeouts" />
          <StatTile label="BB" value={pit.walks} title="Walks" />
          {pit.saves > 0 && <StatTile label="SV" value={pit.saves} title="Saves" />}
        </div>
      )}
    </div>
  );
}

function IndexCell({
  gamePk,
  pred,
  kind,
}: {
  gamePk: number | null;
  pred: PlayerPredictiveResponse | null;
  kind: 'dmg' | 'dom';
}) {
  if (!pred) return <td className="predictive-index player-log-pending">…</td>;
  const value = gamePk != null ? pred.games[gamePk]?.[kind] ?? null : null;
  if (value === null) return <td className="predictive-index">—</td>;
  return <td className={`predictive-index${indexClass(value)}`}>{value}</td>;
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
  const [pred, setPred] = useState<PlayerPredictiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPred(null);
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
    // Progressive enhancement: the log renders immediately; the per-game
    // DMG/DOM column fills in once every feed of the season is crunched
    // (fast when the game-level cache is warm, up to ~30s cold).
    fetchPlayerPredictive(Number(id), season)
      .then((r) => {
        if (!cancelled) setPred(r);
      })
      .catch(() => {
        // column stays as em-dashes - the log itself is unaffected
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

        {!loading && log && <SeasonTotals log={log} />}

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
                    <th title="Damage Index for this game: contact quality + discipline, 100 = league average">DMG</th>
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
                      <IndexCell gamePk={g.gamePk} pred={pred} kind="dmg" />
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
                    <th title="Dominance Index for this game: strike-getting + contact suppression, 100 = league average">DOM</th>
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
                      <IndexCell gamePk={g.gamePk} pred={pred} kind="dom" />
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
