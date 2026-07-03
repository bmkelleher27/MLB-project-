const BASE_URL = 'https://statsapi.mlb.com';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const cache = new Map<string, CacheEntry<unknown>>();

async function getJson<T>(path: string, ttlMs: number): Promise<T> {
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`MLB API request failed: ${path} -> ${res.status}`);
  }
  const value = (await res.json()) as T;
  cache.set(path, { value, expiresAt: Date.now() + ttlMs });
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
    away: { team: { id: number; name: string; abbreviation?: string }; score?: number; isWinner?: boolean };
    home: { team: { id: number; name: string; abbreviation?: string }; score?: number; isWinner?: boolean };
  };
  venue?: { name: string };
  linescore?: {
    currentInning?: number;
    inningState?: string;
    innings?: Array<{ num: number; home?: { runs?: number }; away?: { runs?: number } }>;
  };
}

export function getSchedule(date: string): Promise<RawSchedule> {
  return getJson<RawSchedule>(
    `/api/v1/schedule?sportId=1&date=${date}&hydrate=linescore,team`,
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

// The live feed shape is large/loosely-typed upstream (MLB's "Gumbo" feed);
// we only declare the fields the scorecard transformer actually reads.
export interface RawLiveFeed {
  gamePk: number;
  gameData: {
    status: { abstractGameState: string; detailedState: string };
    venue?: { name: string };
    datetime?: { officialDate?: string; time?: string; ampm?: string };
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
  playEvents?: Array<{
    isPitch?: boolean;
    details?: {
      // Pitch call codes: B/*B ball, C called strike, S swinging strike,
      // W swinging strike (blocked), T foul tip, F foul, D/E/X in play, H HBP
      call?: { code?: string };
      isInPlay?: boolean;
    };
    hitData?: {
      launchSpeed?: number;
      launchAngle?: number;
      totalDistance?: number;
      trajectory?: string;
    };
  }>;
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
