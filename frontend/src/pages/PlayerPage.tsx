import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { LevelId, PlayerLogResponse, PlayerProfileResponse } from '@mlb-scorecards/shared';
import { getLevel } from '@mlb-scorecards/shared';
import { fetchPlayerLog, fetchPlayerProfile } from '../api/client';
import { PlayerProfileSection } from '../components/PlayerProfileSection';
import { LevelPicker } from '../components/LevelPicker';
import { PlayerSearch } from '../components/PlayerSearch';
import { levelFromParam } from '../lib/level';
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

/**
 * Why a profile is empty depends on the level: the minors below Triple-A have
 * little or no pitch tracking, so "no data" there is expected rather than a
 * fault. Saying which it is stops the page looking broken.
 */
function noDataReason(profile: PlayerProfileResponse, season: number): string {
  const level = getLevel(profile.level);

  // Nothing anywhere: the player simply didn't appear that season.
  if (profile.availableLevels.length === 0) {
    return `No games for ${profile.name} in ${season}.`;
  }
  if (level && level.pitchTracking === 'none') {
    return `${profile.name} played at ${level.name} in ${season}, where pitch tracking isn't installed — so there's no pitch data to chart.`;
  }
  if (level && level.id !== 1) {
    return `No pitch-level data for ${profile.name} at ${level.name} in ${season}. Tracking below Triple-A is only installed at some parks.`;
  }
  return `No pitch-level data for ${profile.name} in ${season}. Pitch tracking is available from 2015 onward.`;
}

/** A caveat shown above partial profiles at levels with patchy tracking. */
function trackingNote(profile: PlayerProfileResponse): string | null {
  const level = getLevel(profile.level);
  if (!level || level.pitchTracking === 'full') return null;
  const side = profile.batting ?? profile.pitching;
  const hasPitchData = Boolean(side && (side.arsenal.length > 0 || side.zones.length > 0));
  if (hasPitchData) return null;
  return `Pitch mix and zone charts aren't shown: ${level.name} tracking is only installed at some parks, so no pitch data exists for these games. Season trends and splits below come from box scores and are complete.`;
}

export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const season = parseInt(params.get('season') ?? String(new Date().getFullYear()), 10);
  const seasons = seasonList();
  // The level lives in the URL so a profile at a specific level is linkable.
  const level = levelFromParam(params.get('level'));

  function changeLevel(next: LevelId) {
    const p = new URLSearchParams(params);
    p.set('level', String(next));
    setParams(p, { replace: true });
  }

  const [log, setLog] = useState<PlayerLogResponse | null>(null);
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trends' | 'log'>('trends');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPlayerLog(Number(id), season, level)
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
  }, [id, season, level]);

  // The profile is a separate, slower set of aggregates; it loads alongside the
  // game log rather than blocking it. On a season change the previous render is
  // held at reduced opacity instead of collapsing to a spinner, so the page
  // doesn't jump.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);
    fetchPlayerProfile(Number(id), season, level)
      .then((r) => {
        if (cancelled) return;
        setProfile(r);
        setProfileError(null);
      })
      .catch((err) => {
        // Surfaced rather than swallowed: this is the default tab, so a silent
        // failure here leaves the reader staring at an empty page.
        if (!cancelled) setProfileError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, season, level, profileAttempt]);

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
          {profile && profile.availableLevels.length > 1 && (
            <LevelPicker
              value={level}
              onChange={changeLevel}
              available={profile.availableLevels.map((l) => l.id)}
            />
          )}
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
              id="tab-trends"
              aria-controls="panel-trends"
              aria-selected={tab === 'trends'}
              tabIndex={tab === 'trends' ? 0 : -1}
              className={`player-tab${tab === 'trends' ? ' player-tab-on' : ''}`}
              onClick={() => setTab('trends')}
            >
              Pitch trends
            </button>
            <button
              type="button"
              role="tab"
              id="tab-log"
              aria-controls="panel-log"
              aria-selected={tab === 'log'}
              tabIndex={tab === 'log' ? 0 : -1}
              className={`player-tab${tab === 'log' ? ' player-tab-on' : ''}`}
              onClick={() => setTab('log')}
            >
              Game log
            </button>
          </div>
        )}

        {!loading && tab === 'trends' && (
          <div
            id="panel-trends"
            role="tabpanel"
            aria-labelledby="tab-trends"
            className={profileLoading && profile ? 'profile-refreshing' : undefined}
          >
            {!profile && profileLoading && <p className="status-message">Loading pitch trends…</p>}
            {!profile && !profileLoading && profileError && (
              <div className="status-message status-error">
                <p>Couldn’t load pitch trends: {profileError}</p>
                <button
                  type="button"
                  className="trend-chip"
                  onClick={() => setProfileAttempt((n) => n + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {!profile && !profileLoading && !profileError && (
              <p className="status-message">No pitch trends available for this player.</p>
            )}
            {profile && !profile.batting && !profile.pitching && (
              <p className="status-message">
                {noDataReason(profile, season)}
              </p>
            )}
            {profile && (profile.batting ?? profile.pitching) && trackingNote(profile) && (
              <p className="profile-tracking-note">{trackingNote(profile)}</p>
            )}
            {profile?.batting && (
              <PlayerProfileSection side={profile.batting} mode="batting" playerName={profile.name} />
            )}
            {profile?.pitching && (
              <PlayerProfileSection side={profile.pitching} mode="pitching" playerName={profile.name} />
            )}
          </div>
        )}

        {!loading && tab === 'log' && (
          <div id="panel-log" role="tabpanel" aria-labelledby="tab-log">
        {log && log.batting.length > 0 && (
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

        {log && log.pitching.length > 0 && (
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
        <p className="player-page-note">Click a row to open that game's scorecard.</p>
          </div>
        )}
      </div>
    </>
  );
}
