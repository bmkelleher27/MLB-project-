import type {
  AtBatDetailResponse,
  PlayerLogResponse,
  Scorecard,
  ScheduleResponse,
  SeasonPredictiveResponse,
  SeasonResponse,
  TeamInfo,
} from '@mlb-scorecards/shared';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function fetchSchedule(date: string): Promise<ScheduleResponse> {
  const res = await fetch(`${API_BASE}/api/schedule?date=${date}`);
  if (!res.ok) throw new Error(`schedule request failed: ${res.status}`);
  return res.json() as Promise<ScheduleResponse>;
}

export async function fetchScorecard(gamePk: number): Promise<Scorecard> {
  const res = await fetch(`${API_BASE}/api/game/${gamePk}/scorecard`);
  if (!res.ok) throw new Error(`scorecard request failed: ${res.status}`);
  return res.json() as Promise<Scorecard>;
}

export async function fetchAtBat(gamePk: number, atBatIndex: number): Promise<AtBatDetailResponse> {
  const res = await fetch(`${API_BASE}/api/game/${gamePk}/atbat/${atBatIndex}`);
  if (!res.ok) throw new Error(`at-bat request failed: ${res.status}`);
  return res.json() as Promise<AtBatDetailResponse>;
}

export async function fetchRandomGame(): Promise<{ gamePk: number; date: string }> {
  const res = await fetch(`${API_BASE}/api/random-game`);
  if (!res.ok) throw new Error(`random-game request failed: ${res.status}`);
  return res.json() as Promise<{ gamePk: number; date: string }>;
}

export async function fetchTeams(season: number): Promise<TeamInfo[]> {
  const res = await fetch(`${API_BASE}/api/teams?season=${season}`);
  if (!res.ok) throw new Error(`teams request failed: ${res.status}`);
  const body = (await res.json()) as { teams: TeamInfo[] };
  return body.teams;
}

export async function fetchSeason(teamId: number, season: number): Promise<SeasonResponse> {
  const res = await fetch(`${API_BASE}/api/season?teamId=${teamId}&season=${season}`);
  if (!res.ok) throw new Error(`season request failed: ${res.status}`);
  return res.json() as Promise<SeasonResponse>;
}

export async function fetchPlayerLog(id: number, season: number): Promise<PlayerLogResponse> {
  const res = await fetch(`${API_BASE}/api/player/${id}?season=${season}`);
  if (!res.ok) throw new Error(`player request failed: ${res.status}`);
  return res.json() as Promise<PlayerLogResponse>;
}

export async function fetchSeasonPredictive(teamId: number, season: number): Promise<SeasonPredictiveResponse> {
  const res = await fetch(`${API_BASE}/api/season/predictive?teamId=${teamId}&season=${season}`);
  if (!res.ok) throw new Error(`season predictive request failed: ${res.status}`);
  return res.json() as Promise<SeasonPredictiveResponse>;
}
