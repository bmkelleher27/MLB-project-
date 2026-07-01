import type { Scorecard, ScheduleResponse } from '@mlb-scorecards/shared';

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

export async function fetchRandomGame(): Promise<{ gamePk: number; date: string }> {
  const res = await fetch(`${API_BASE}/api/random-game`);
  if (!res.ok) throw new Error(`random-game request failed: ${res.status}`);
  return res.json() as Promise<{ gamePk: number; date: string }>;
}
