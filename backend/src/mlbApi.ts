import { TtlCache } from './cache.js';

const BASE_URL = 'https://statsapi.mlb.com';

// Bounded so a long-running server can't accumulate stale entries without limit.
// Live feeds are never cached (ttl 0), so entries here are the smaller
// schedule/season/teams/player payloads.
const CACHE_MAX_ENTRIES = 500;
const CACHE_SWEEP_MS = 10 * 60_000;

/**
 * Byte budget for cached MLB payloads. An entry cap alone does not bound
 * memory here: responses range from a 5 KB zone chart to a 1.3 MB pitch log,
 * and parsed objects sit at roughly 1.3x their JSON length in heap, so 500
 * unbounded entries could exceed 800 MB — more than a small instance has.
 * 48 MB of JSON keeps the working set useful while leaving headroom.
 */
const CACHE_MAX_BYTES = 48 * 1024 * 1024;

/** Outbound requests to MLB are aborted rather than hanging a request forever. */
const FETCH_TIMEOUT_MS = 8_000;

const cache = new TtlCache<unknown>(CACHE_MAX_ENTRIES, CACHE_MAX_BYTES);

// Proactively drop expired entries so memory doesn't hold them until the next
// read; unref'd so it never keeps the process alive.
const sweepTimer = setInterval(() => cache.sweep(), CACHE_SWEEP_MS);
sweepTimer.unref?.();

/** Cache occupancy, surfaced by the health endpoint. */
export function cacheStats(): { entries: number; bytes: number; maxBytes: number } {
  return { entries: cache.size, bytes: cache.bytes, maxBytes: CACHE_MAX_BYTES };
}

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
  const cached = cache.get(path);
  if (cached !== undefined) {
    return cached as T;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    // A timeout surfaces as an AbortError; name it so callers report it usefully.
    const reason = (err as Error).name === 'TimeoutError' ? `timed out after ${FETCH_TIMEOUT_MS}ms` : (err as Error).message;
    throw new Error(`MLB API request failed: ${path} -> ${reason}`);
  }
  if (!res.ok) {
    throw new Error(`MLB API request failed: ${path} -> ${res.status}`);
  }

  // Read as text first so the payload's size is known without re-serialising it;
  // the byte budget depends on having a real measurement per entry.
  const text = await res.text();
  const value = JSON.parse(text) as T;
  cache.set(path, value, ttlMs, { bytes: text.length });
  return value;
}

export interface RawSchedule {
  dates: Array<{
    date: string;
    games: RawScheduleGame[];
  }>;
}

export interface RawScheduleGame {
  gamePk: number;
  gameDate: string;
  gameType?: string;
  status: { abstractGameState: string; detailedState: string };
  teams: {
    away: { team: { id: number; name: string; abbreviation?: string }; score?: number; isWinner?: boolean; probablePitcher?: { id: number; fullName: string } };
    home: { team: { id: number; name: string; abbreviation?: string }; score?: number; isWinner?: boolean; probablePitcher?: { id: number; fullName: string } };
  };
  venue?: { name: string };
  linescore?: {
    currentInning?: number;
    inningState?: string;
    outs?: number;
    balls?: number;
    strikes?: number;
    innings?: Array<{ num: number; home?: { runs?: number; hits?: number }; away?: { runs?: number; hits?: number } }>;
    teams?: {
      home?: { runs?: number; hits?: number; errors?: number };
      away?: { runs?: number; hits?: number; errors?: number };
    };
    offense?: {
      batter?: { id: number; fullName: string };
      first?: { id: number };
      second?: { id: number };
      third?: { id: number };
    };
    defense?: {
      pitcher?: { id: number; fullName: string };
    };
  };
}

export function getSchedule(date: string, sportId = 1): Promise<RawSchedule> {
  return getJson<RawSchedule>(
    `/api/v1/schedule?sportId=${sportId}&date=${date}&hydrate=linescore,team,probablePitcher`,
    15_000
  );
}

// Regular season + all postseason rounds; spring training excluded.
export function getTeamSeasonSchedule(teamId: number, season: number): Promise<RawSchedule> {
  return getJson<RawSchedule>(
    `/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&gameTypes=R,F,D,L,W&hydrate=team`,
    60_000
  );
}

export interface RawTeamsResponse {
  teams: Array<{ id: number; name: string; abbreviation?: string }>;
}

export function getTeams(season: number): Promise<RawTeamsResponse> {
  return getJson<RawTeamsResponse>(`/api/v1/teams?sportId=1&season=${season}`, 3_600_000);
}

export interface RawPerson {
  people: Array<{
    id: number;
    fullName: string;
    primaryPosition?: { abbreviation?: string };
    currentTeam?: { name?: string };
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  }>;
}

export function getPerson(personId: number): Promise<RawPerson> {
  return getJson<RawPerson>(`/api/v1/people/${personId}`, 3_600_000);
}

export interface RawRoster {
  roster?: Array<{
    person: { id: number; fullName: string };
    position?: { abbreviation?: string };
  }>;
}

export function getActiveRoster(teamId: number): Promise<RawRoster> {
  return getJson<RawRoster>(`/api/v1/teams/${teamId}/roster?rosterType=active`, 3_600_000);
}

/** Career batter-vs-pitcher line (a RawGameLog-shaped stats envelope). */
export function getVsPitcherTotal(batterId: number, pitcherId: number): Promise<RawGameLog> {
  return getJson<RawGameLog>(
    `/api/v1/people/${batterId}/stats?stats=vsPlayerTotal&opposingPlayerId=${pitcherId}&group=hitting`,
    3_600_000
  );
}

export interface RawGameLog {
  stats?: Array<{
    splits?: Array<{
      date?: string;
      isHome?: boolean;
      opponent?: { id?: number; name?: string };
      game?: { gamePk?: number };
      stat?: Record<string, unknown>;
    }>;
  }>;
}

/**
 * `sportId` selects which level's stats come back. Omitting it implies the
 * majors, which returns nothing for a player who only appeared in the minors —
 * so every player-stat call threads the level through.
 */
function levelParam(sportId?: number): string {
  return sportId != null ? `&sportId=${sportId}` : '';
}

export function getPersonSeasonStats(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawGameLog> {
  return getJson<RawGameLog>(
    `/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${season}${levelParam(sportId)}`,
    60_000
  );
}

export function getPersonGameLog(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawGameLog> {
  return getJson<RawGameLog>(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}${levelParam(sportId)}`,
    60_000
  );
}

// The live feed shape is large/loosely-typed upstream (MLB's "Gumbo" feed);
// we only declare the fields the scorecard transformer actually reads.
export interface RawLiveFeed {
  gamePk: number;
  gameData: {
    status: { abstractGameState: string; detailedState: string };
    venue?: { name: string };
    datetime?: { officialDate?: string; time?: string; ampm?: string };
    // The boxscore's team object has no abbreviation; gameData's does.
    teams?: {
      away?: { abbreviation?: string };
      home?: { abbreviation?: string };
    };
    probablePitchers?: {
      away?: { id: number; fullName: string };
      home?: { id: number; fullName: string };
    };
    // Bio directory for everyone attached to the game; used for pitch hand.
    players?: Record<string, { pitchHand?: { code?: string } }>;
  };
  liveData: {
    plays: { allPlays: RawPlay[] };
    linescore: RawLinescore;
    boxscore: {
      teams: {
        away: RawBoxscoreTeam;
        home: RawBoxscoreTeam;
      };
    };
  };
}

export interface RawBoxscoreTeam {
  team: { id: number; name: string; abbreviation?: string };
  pitchers: number[];
  players: Record<
    string,
    {
      person: { id: number; fullName: string };
      position?: { abbreviation?: string };
      battingOrder?: string;
      stats?: {
        batting?: {
          hits?: number;
          atBats?: number;
          homeRuns?: number;
          rbi?: number;
        };
        pitching?: {
          inningsPitched?: string;
          hits?: number;
          runs?: number;
          earnedRuns?: number;
          baseOnBalls?: number;
          strikeOuts?: number;
          homeRuns?: number;
          numberOfPitches?: number;
          wins?: number;
          losses?: number;
          saves?: number;
        };
      };
    }
  >;
}

export interface RawRunnerMovement {
  start: string | null;
  end: string | null;
  outBase: string | null;
  isOut: boolean;
  outNumber: number | null;
}

export interface RawRunnerCredit {
  position: { code: string; abbreviation: string };
  credit: string;
}

export interface RawRunner {
  movement: RawRunnerMovement;
  details: {
    event: string | null;
    eventType: string | null;
    runner: { id: number; fullName: string };
    isScoringEvent: boolean;
    rbi: boolean;
  };
  credits: RawRunnerCredit[];
}

export interface RawPlay {
  result: {
    type: string;
    event: string;
    eventType: string;
    description: string;
    rbi: number;
    isOut: boolean;
  };
  about: {
    atBatIndex: number;
    halfInning: 'top' | 'bottom';
    inning: number;
    isComplete: boolean;
  };
  count: { balls: number; strikes: number; outs: number };
  matchup: {
    batter: { id: number; fullName: string };
    pitcher: { id: number; fullName: string };
  };
  runners: RawRunner[];
  playEvents?: RawPlayEvent[];
}

export interface RawPlayEvent {
  isPitch?: boolean;
  pitchNumber?: number;
  count?: { balls?: number; strikes?: number };
  details?: {
    // Pitch call codes: B/*B ball, C called strike, S swinging strike,
    // W swinging strike (blocked), T foul tip, F foul, D/E/X in play, H HBP
    call?: { code?: string };
    description?: string;
    type?: { code?: string; description?: string };
    isBall?: boolean;
    isStrike?: boolean;
    isInPlay?: boolean;
  };
  pitchData?: {
    startSpeed?: number;
    extension?: number;
    strikeZoneTop?: number;
    strikeZoneBottom?: number;
    coordinates?: { pX?: number; pZ?: number };
    breaks?: {
      spinRate?: number;
      breakVerticalInduced?: number;
      breakHorizontal?: number;
    };
  };
  hitData?: {
    launchSpeed?: number;
    launchAngle?: number;
    totalDistance?: number;
    trajectory?: string;
    // Gameday field coordinates (0-250 grid, home plate near x=125, y=200).
    coordinates?: { coordX?: number; coordY?: number };
  };
}

export interface RawLinescore {
  currentInning?: number;
  inningState?: string;
  balls?: number;
  strikes?: number;
  outs?: number;
  offense?: {
    first?: { id: number };
    second?: { id: number };
    third?: { id: number };
  };
  innings: Array<{
    num: number;
    home: { runs: number; hits: number; leftOnBase: number; errors: number };
    away: { runs: number; hits: number; leftOnBase: number; errors: number };
  }>;
  teams: {
    home: { runs: number; hits: number; errors: number };
    away: { runs: number; hits: number; errors: number };
  };
}

export function getLiveFeed(gamePk: number): Promise<RawLiveFeed> {
  return getJson<RawLiveFeed>(`/api/v1.1/game/${gamePk}/feed/live`, 0);
}

// ── Player search & aggregate (season-level) stat endpoints ─────────────
// These are all pre-aggregated by MLB, so a full player profile costs a
// handful of small requests rather than one live feed per game played.

export interface RawPeopleSearch {
  people?: Array<{
    id: number;
    fullName: string;
    active?: boolean;
    primaryPosition?: { abbreviation?: string };
    currentTeam?: { name?: string };
    batSide?: { code?: string };
    pitchHand?: { code?: string };
  }>;
}

export function searchPeople(name: string): Promise<RawPeopleSearch> {
  return getJson<RawPeopleSearch>(
    `/api/v1/people/search?names=${encodeURIComponent(name)}&hydrate=currentTeam`,
    600_000
  );
}

export interface RawPitchArsenal {
  stats?: Array<{
    splits?: Array<{
      stat?: {
        percentage?: number;
        count?: number;
        totalPitches?: number;
        averageSpeed?: number;
        type?: { code?: string; description?: string };
      };
    }>;
  }>;
}

/**
 * group=pitching -> the pitch mix this player throws.
 * group=hitting  -> the pitch mix thrown *to* this player.
 */
export function getPitchArsenal(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawPitchArsenal> {
  return getJson<RawPitchArsenal>(
    `/api/v1/people/${personId}/stats?stats=pitchArsenal&group=${group}&season=${season}${levelParam(sportId)}`,
    600_000
  );
}

export interface RawHotColdZones {
  stats?: Array<{
    splits?: Array<{
      stat?: {
        name?: string;
        zones?: Array<{ zone?: string; value?: string; temp?: string }>;
      };
    }>;
  }>;
}

export function getHotColdZones(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawHotColdZones> {
  return getJson<RawHotColdZones>(
    `/api/v1/people/${personId}/stats?stats=hotColdZones&group=${group}&season=${season}${levelParam(sportId)}`,
    600_000
  );
}

export interface RawStatSplits {
  stats?: Array<{
    splits?: Array<{
      split?: { code?: string; description?: string };
      stat?: Record<string, unknown>;
    }>;
  }>;
}

/** Situational splits (vl/vr = vs left/right-handed opponent). */
export function getStatSplits(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sitCodes: string,
  sportId?: number
): Promise<RawStatSplits> {
  return getJson<RawStatSplits>(
    `/api/v1/people/${personId}/stats?stats=statSplits&group=${group}&season=${season}&sitCodes=${sitCodes}${levelParam(sportId)}`,
    600_000
  );
}

export interface RawByMonth {
  stats?: Array<{
    splits?: Array<{
      month?: number;
      stat?: Record<string, unknown>;
    }>;
  }>;
}

export function getByMonth(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawByMonth> {
  return getJson<RawByMonth>(
    `/api/v1/people/${personId}/stats?stats=byMonth&group=${group}&season=${season}${levelParam(sportId)}`,
    600_000
  );
}

/**
 * Per-pitch logs. `playLog` is one entry per plate appearance, tagged with the
 * pitch type that ended it; `pitchLog` is every individual pitch with its call.
 * Together they give performance (AVG/SLG) and swing behaviour (whiff rate)
 * broken out by pitch type — neither is available pre-aggregated.
 */
export interface RawPitchLogEntry {
  stat?: {
    play?: {
      details?: {
        call?: { code?: string; description?: string };
        event?: string;
        eventType?: string;
        isInPlay?: boolean;
        isStrike?: boolean;
        isBall?: boolean;
        isBaseHit?: boolean;
        isAtBat?: boolean;
        isPlateAppearance?: boolean;
        type?: { code?: string; description?: string };
      };
    };
  };
}

export interface RawPitchLog {
  stats?: Array<{ splits?: RawPitchLogEntry[] }>;
}

function pitchLogUrl(
  personId: number, season: number, group: string, stat: string, sportId?: number
): string {
  return `/api/v1/people/${personId}/stats?stats=${stat}&group=${group}&season=${season}${levelParam(sportId)}`;
}

/**
 * One entry per plate appearance (the pitch that ended it), and one entry per
 * pitch, respectively. Both are deliberately *not* cached: a pitch log is ~1.3 MB
 * of JSON (~1.7 MB parsed), and holding many of them is what would blow the
 * memory budget. The caller caches the small derived per-pitch-type summary
 * instead, so repeat views still skip the round trip.
 */
export function getPlayLog(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawPitchLog> {
  return getJson<RawPitchLog>(pitchLogUrl(personId, season, group, 'playLog', sportId), 0);
}

export function getPitchLog(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching',
  sportId?: number
): Promise<RawPitchLog> {
  return getJson<RawPitchLog>(pitchLogUrl(personId, season, group, 'pitchLog', sportId), 0);
}
