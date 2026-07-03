import type { TeamPredictive } from '@mlb-scorecards/shared';
import { getLiveFeed } from '../mlbApi.js';
import { buildPredictive } from './predictive.js';

export interface GamePredictive {
  away: TeamPredictive;
  home: TeamPredictive;
}

// A Final game's per-game predictive lines never change, and they're tiny
// compared to the ~2MB feed they're derived from - cache them forever.
const cache = new Map<number, GamePredictive>();
const inflight = new Map<number, Promise<GamePredictive>>();

export async function getGamePredictive(gamePk: number): Promise<GamePredictive> {
  const cached = cache.get(gamePk);
  if (cached) return cached;

  let promise = inflight.get(gamePk);
  if (!promise) {
    promise = (async () => {
      const feed = await getLiveFeed(gamePk);
      const result = buildPredictive(feed);
      if (feed.gameData.status.abstractGameState === 'Final') cache.set(gamePk, result);
      return result;
    })();
    inflight.set(gamePk, promise);
    promise.finally(() => inflight.delete(gamePk));
  }
  return promise;
}
