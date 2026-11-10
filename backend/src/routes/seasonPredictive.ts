import { Router } from 'express';
import type { SeasonPredictiveResponse } from '@mlb-scorecards/shared';
import { setShortCache } from '../http.js';
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
const CURRENT_SEASON_TTL_MS = 3_600_000;

/**
 * Running totals for one team-season, plus which games are already in them.
 *
 * A finished game never changes, so its feed only ever needs reading once.
 * Keeping the accumulators means an hourly refresh of the current season reads
 * the handful of games played since the last one, rather than downloading all
 * ~160 one-megabyte feeds again. The totals are a few KB per team-season.
 */
interface TeamSeasonState {
  batters: Map<number, BatterAcc>;
  pitchers: Map<number, PitcherAcc>;
  processed: Set<number>;
}

const states = new Map<string, TeamSeasonState>();
const cache = new Map<string, { expiresAt: number; value: SeasonPredictiveResponse }>();
const inflight = new Map<string, Promise<SeasonPredictiveResponse>>();

async function computeSeasonPredictive(
  key: string,
  teamId: number,
  season: number
): Promise<{ value: SeasonPredictiveResponse; complete: boolean }> {
  const schedule = await getTeamSeasonSchedule(teamId, season);
  // MLB lists a suspended/resumed game under both its original and makeup
  // date; the Set keeps it from being counted twice.
  const finalPks = new Set(
    (schedule.dates ?? [])
      .flatMap((d) => d.games)
      .filter((g) => g.status.abstractGameState === 'Final')
      .map((g) => g.gamePk)
  );

  let state = states.get(key);
  if (!state) {
    state = { batters: new Map(), pitchers: new Map(), processed: new Set() };
    states.set(key, state);
  }
  const { batters, pitchers, processed } = state;
  const todo = [...finalPks].filter((pk) => !processed.has(pk));

  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const pk = todo[cursor++];
      let feed;
      try {
        feed = await getLiveFeed(pk);
      } catch {
        // Not marked processed, so the next refresh tries this game again.
        continue;
      }
      // Marked before accumulating: a feed that throws part-way through must
      // not be replayed later on top of its own partial tallies.
      processed.add(pk);
      try {
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
      } catch {
        // a malformed feed contributes whatever it managed to
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const value: SeasonPredictiveResponse = {
    teamId,
    season,
    gamesProcessed: processed.size,
    batters: [...batters.values()].map(finalizeBatter).sort((a, b) => b.dmg - a.dmg),
    pitchers: [...pitchers.values()].map(finalizePitcher).sort((a, b) => b.dom - a.dom),
  };
  return { value, complete: [...finalPks].every((pk) => processed.has(pk)) };
}

/** Cached result, a build already under way, or a new build — in that order. */
function seasonPredictive(teamId: number, season: number): Promise<SeasonPredictiveResponse> {
  const key = `${teamId}-${season}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);

  const pending = inflight.get(key);
  if (pending) return pending;

  const build = computeSeasonPredictive(key, teamId, season)
    .then(({ value, complete }) => {
      // A finished season with every game read never changes: keep the answer
      // for good and release the working totals. Anything else (the current
      // season, or a past one where some feeds failed) is refreshed hourly,
      // and that refresh only reads what is still missing.
      const settled = complete && season < new Date().getFullYear();
      if (settled) states.delete(key);
      cache.set(key, {
        expiresAt: settled ? Number.POSITIVE_INFINITY : Date.now() + CURRENT_SEASON_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, build);
  return build;
}

router.get('/', async (req, res) => {
  const teamId = parseInt(String(req.query.teamId), 10);
  const season = parseInt(String(req.query.season), 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(teamId) || !Number.isFinite(season) || season < FIRST_SEASON || season > currentYear) {
    res.status(400).json({ error: `teamId and season (${FIRST_SEASON}-${currentYear}) are required` });
    return;
  }
  try {
    const value = await seasonPredictive(teamId, season);
    setShortCache(res, 300);
    res.json(value);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
