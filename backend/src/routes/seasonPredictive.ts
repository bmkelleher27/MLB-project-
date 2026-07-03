import { Router } from 'express';
import type { SeasonPredictiveResponse } from '@mlb-scorecards/shared';
import { getLiveFeed, getTeamSeasonSchedule } from '../mlbApi.js';
import {
  accumulateFeed,
  finalizeBatter,
  finalizePitcher,
  newSideMaps,
  type BatterAcc,
  type PitcherAcc,
} from '../scorecard/predictive.js';

const router = Router();

const FIRST_SEASON = 2010;
const CONCURRENCY = 6;

// A finished season's aggregate never changes; the current season's is
// cached for an hour. Results are small (a few KB per team-season).
const cache = new Map<string, { expiresAt: number; value: SeasonPredictiveResponse }>();
const inflight = new Map<string, Promise<SeasonPredictiveResponse>>();

async function computeSeasonPredictive(teamId: number, season: number): Promise<SeasonPredictiveResponse> {
  const schedule = await getTeamSeasonSchedule(teamId, season);
  const gamePks = (schedule.dates ?? [])
    .flatMap((d) => d.games)
    .filter((g) => g.status.abstractGameState === 'Final')
    .map((g) => g.gamePk);

  const batters = new Map<number, BatterAcc>();
  const pitchers = new Map<number, PitcherAcc>();
  let processed = 0;

  let cursor = 0;
  async function worker() {
    while (cursor < gamePks.length) {
      const pk = gamePks[cursor++];
      try {
        const feed = await getLiveFeed(pk);
        const isAway = feed.liveData.boxscore.teams.away.team.id === teamId;
        // Route only the selected team's halves into the season maps;
        // the opponent's tallies go to throwaway maps.
        const maps = newSideMaps();
        if (isAway) {
          maps.awayBatters = batters;
          maps.awayPitchers = pitchers;
        } else {
          maps.homeBatters = batters;
          maps.homePitchers = pitchers;
        }
        accumulateFeed(feed, maps);
        processed++;
      } catch {
        // skip games whose feed fails - aggregate over the rest
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return {
    teamId,
    season,
    gamesProcessed: processed,
    batters: [...batters.values()].map(finalizeBatter).sort((a, b) => b.dmg - a.dmg),
    pitchers: [...pitchers.values()].map(finalizePitcher).sort((a, b) => b.dom - a.dom),
  };
}

router.get('/', async (req, res) => {
  const teamId = parseInt(String(req.query.teamId), 10);
  const season = parseInt(String(req.query.season), 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(teamId) || !Number.isFinite(season) || season < FIRST_SEASON || season > currentYear) {
    res.status(400).json({ error: `teamId and season (${FIRST_SEASON}-${currentYear}) are required` });
    return;
  }
  const key = `${teamId}-${season}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.value);
    return;
  }
  try {
    let promise = inflight.get(key);
    if (!promise) {
      promise = computeSeasonPredictive(teamId, season);
      inflight.set(key, promise);
      promise.finally(() => inflight.delete(key));
    }
    const value = await promise;
    const ttl = season < currentYear ? Number.POSITIVE_INFINITY : 3_600_000;
    cache.set(key, { expiresAt: Date.now() + ttl, value });
    res.json(value);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
