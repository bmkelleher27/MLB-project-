import type { GameAtBatsResponse, Scorecard } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getLiveFeed } from '../mlbApi.js';
import { buildGameAtBats } from './atbats.js';
import { transformLiveFeed } from './transform.js';

/**
 * One place that turns a gamePk into the responses the app serves, shared by
 * the REST routes and the socket rooms so both hit the same cache.
 *
 * A Final game's feed is immutable, but the raw feed is ~1 MB — too big to keep
 * many of. The small *transformed* responses are cached instead (a scorecard is
 * ~30-60 KB, an at-bats body ~100-200 KB), so repeat views of finished games
 * skip both the MLB round-trip and the transform. Live and Preview games are
 * never cached here; they must stay fresh.
 */
const FINAL_TTL_MS = 6 * 60 * 60 * 1000;
const scorecardCache = new TtlCache<Scorecard>(100);
const atBatsCache = new TtlCache<GameAtBatsResponse>(50);

function isFinal(body: { status: { abstractGameState: string } }): boolean {
  return body.status.abstractGameState === 'Final';
}

/** Keeps a scorecard if its game is over; returns it either way. */
export function rememberScorecard(scorecard: Scorecard): Scorecard {
  if (isFinal(scorecard)) scorecardCache.set(String(scorecard.gamePk), scorecard, FINAL_TTL_MS);
  return scorecard;
}

/** Keeps an at-bats body if its game is over; returns it either way. */
export function rememberAtBats(body: GameAtBatsResponse): GameAtBatsResponse {
  if (isFinal(body)) atBatsCache.set(String(body.gamePk), body, FINAL_TTL_MS);
  return body;
}

export async function loadScorecard(gamePk: number): Promise<Scorecard> {
  const cached = scorecardCache.get(String(gamePk));
  if (cached) return cached;
  return rememberScorecard(transformLiveFeed(await getLiveFeed(gamePk)));
}

export async function loadAtBats(gamePk: number): Promise<GameAtBatsResponse> {
  const cached = atBatsCache.get(String(gamePk));
  if (cached) return cached;
  return rememberAtBats(buildGameAtBats(await getLiveFeed(gamePk), gamePk));
}

/**
 * A scorecard's content with the build timestamp blanked.
 *
 * `updatedAt` is stamped fresh on every transform, so comparing whole payloads
 * reports a change on every poll even when the game has not moved. Change
 * detection has to ignore it.
 */
export function scorecardSignature(scorecard: Scorecard): string {
  return JSON.stringify({ ...scorecard, updatedAt: '' });
}
