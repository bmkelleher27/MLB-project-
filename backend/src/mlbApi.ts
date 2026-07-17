import { TtlCache } from './cache.js';

const BASE_URL = 'https://statsapi.mlb.com';

// Bounded so a long-running server can't accumulate stale entries without limit.
// Live feeds are never cached (ttl 0), so entries here are the smaller
// schedule/season/teams/player payloads.
const CACHE_MAX_ENTRIES = 500;
const CACHE_SWEEP_MS = 10 * 60_000;

const cache = new TtlCache<unknown>(CACHE_MAX_ENTRIES);

// Proactively drop expired entries so memory doesn't hold them until the next
// read; unref'd so it never keeps the process alive.
const sweepTimer = setInterval(() => cache.sweep(), CACHE_SWEEP_MS);
sweepTimer.unref?.();

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
  const cached = cache.get(path);
  if (cached !== undefined) {
    return cached as T;
  }
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`MLB API request failed: ${path} -> ${res.status}`);
  }
  const value = (await res.json()) as T;
  cache.set(path, value, ttlMs);
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

export function getSchedule(date: string): Promise<RawSchedule> {
  return getJson<RawSchedule>(
    `/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team,probablePitcher`,
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

export function getPersonSeasonStats(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching'
): Promise<RawGameLog> {
  return getJson<RawGameLog>(
    `/api/v1/people/${personId}/stats?stats=season&group=${group}&season=${season}`,
    60_000
  );
}

export function getPersonGameLog(
  personId: number,
  season: number,
  group: 'hitting' | 'pitching'
): Promise<RawGameLog> {
  return getJson<RawGameLog>(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=${group}&season=${season}`,
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
