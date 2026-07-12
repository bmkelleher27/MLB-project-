import type {
  GameAtBatsResponse,
  PlayerLogResponse,
  Scorecard,
  ScheduleResponse,
  SeasonPredictiveResponse,
  SeasonResponse,
  TeamInfo,
} from '@mlb-scorecards/shared';
import { API_BASE } from '../lib/apiBase';

async function getJson<T>(path: string, label: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${label} request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchSchedule(date: string): Promise<ScheduleResponse> {
  return getJson(`/api/schedule?date=${date}`, 'schedule');
}

export function fetchScorecard(gamePk: number): Promise<Scorecard> {
  return getJson(`/api/game/${gamePk}/scorecard`, 'scorecard');
}

export function fetchGameAtBats(gamePk: number): Promise<GameAtBatsResponse> {
  return getJson(`/api/game/${gamePk}/atbats`, 'at-bats');
}

export function fetchRandomGame(): Promise<{ gamePk: number; date: string }> {
  return getJson('/api/random-game', 'random-game');
}

export async function fetchTeams(season: number): Promise<TeamInfo[]> {
  const body = await getJson<{ teams: TeamInfo[] }>(`/api/teams?season=${season}`, 'teams');
  return body.teams;
}

export function fetchSeason(teamId: number, season: number): Promise<SeasonResponse> {
  return getJson(`/api/season?teamId=${teamId}&season=${season}`, 'season');
}

export function fetchPlayerLog(id: number, season: number): Promise<PlayerLogResponse> {
  return getJson(`/api/player/${id}?season=${season}`, 'player');
}

export function fetchSeasonPredictive(teamId: number, season: number): Promise<SeasonPredictiveResponse> {
  return getJson(`/api/season/predictive?teamId=${teamId}&season=${season}`, 'season predictive');
}
