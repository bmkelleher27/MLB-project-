import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { PlayerLogResponse, PlayerProfileResponse } from '@mlb-scorecards/shared';
import { fetchPlayerLog, fetchPlayerProfile } from '../api/client';
import { PlayerProfileSection } from '../components/PlayerProfileSection';
import { PlayerSearch } from '../components/PlayerSearch';
import { formatShortDate, seasonList } from '../lib/date';

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

export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const season = parseInt(params.get('season') ?? String(new Date().getFullYear()), 10);
  const seasons = seasonList();

  const [log, setLog] = useState<PlayerLogResponse | null>(null);
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trends' | 'log'>('trends');

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

  // The profile is a separate, slower set of aggregates; it loads alongside the
  // game log rather than blocking it. On a season change the previous render is
  // held at reduced opacity instead of collapsing to a spinner, so the page
  // doesn't jump.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setProfileLoading(true);
    fetchPlayerProfile(Number(id), season)
      .then((r) => {
        if (!cancelled) setProfile(r);
      })
      .catch(() => {
        // The game log still stands on its own if the aggregates fail.
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
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
        <span className="scorecard-nav-date">Player profile</span>
        <PlayerSearch />
      </div>
      <div className="player-page viz-scope">
        <div className="player-header">
          <h1>
            {log?.name ?? 'Player'}
            {log?.position && <span className="player-header-pos">{log.position}</span>}
            {profile && (profile.bats || profile.throws) && (
              <span className="player-header-hand" title="Bats / throws">
                {profile.bats ?? '—'}/{profile.throws ?? '—'}
              </span>
            )}
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

        {!loading && log && (
          <div className="player-tabs" role="tablist" aria-label="Player views">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'trends'}
              className={`player-tab${tab === 'trends' ? ' player-tab-on' : ''}`}
              onClick={() => setTab('trends')}
            >
              Pitch trends
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'log'}
              className={`player-tab${tab === 'log' ? ' player-tab-on' : ''}`}
              onClick={() => setTab('log')}
            >
              Game log
            </button>
          </div>
        )}

        {!loading && tab === 'trends' && (
          <div className={profileLoading && profile ? 'profile-refreshing' : undefined}>
            {!profile && profileLoading && <p className="status-message">Loading pitch trends…</p>}
            {profile && !profile.batting && !profile.pitching && (
              <p className="status-message">
                No pitch-level data for {profile.name} in {season}. Pitch tracking is available from
                2015 onward.
              </p>
            )}
            {profile?.batting && (
              <PlayerProfileSection side={profile.batting} mode="batting" playerName={profile.name} />
            )}
            {profile?.pitching && (
              <PlayerProfileSection side={profile.pitching} mode="pitching" playerName={profile.name} />
            )}
          </div>
        )}

        {!loading && tab === 'log' && log && log.batting.length > 0 && (
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
                      <td>{formatShortDate(g.date)}</td>
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

        {!loading && tab === 'log' && log && log.pitching.length > 0 && (
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
                      <td>{formatShortDate(g.date)}</td>
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
        {tab === 'log' && (
          <p className="player-page-note">Click a row to open that game's scorecard.</p>
        )}
      </div>
    </>
  );
}
