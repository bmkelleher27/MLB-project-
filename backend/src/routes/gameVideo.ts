import type { Response } from 'express';
import type { GameVideoResponse } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getGameContent, getScheduleGame } from '../mlbApi.js';
import { pickGameVideos } from '../video/mlbContent.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Lookups by gamePk, holding only the reduced result (the raw content payload
 * is several hundred KB). Found videos are stable, so hits are kept for a
 * month. A miss on a recent game is retried soon, because MLB posts the recap
 * and condensed game within an hour or so of the final out; a miss on an old
 * game is unlikely to change.
 */
const lookupCache = new TtlCache<GameVideoResponse>(2_000);
const inflight = new Map<number, Promise<GameVideoResponse>>();

async function lookup(gamePk: number): Promise<GameVideoResponse | 'not-final'> {
  const schedule = await getScheduleGame(gamePk);
  const raw = schedule.dates?.flatMap((d) => d.games).find((g) => g.gamePk === gamePk);
  if (!raw) throw new Error('game not found');
  if (raw.status.abstractGameState !== 'Final') return 'not-final';

  const cached = lookupCache.get(String(gamePk));
  if (cached) return cached;

  let pending = inflight.get(gamePk);
  if (!pending) {
    pending = (async () => {
      let body: GameVideoResponse = { gamePk, videos: [] };
      let ttl: number;
      try {
        body = { gamePk, videos: pickGameVideos(await getGameContent(gamePk)) };
        const recent = Date.now() - Date.parse(raw.gameDate) < 2 * DAY;
        ttl = body.videos.length === 2 ? 30 * DAY : recent ? 20 * MINUTE : 7 * DAY;
      } catch (err) {
        // The scorecard works without video, so a failed lookup answers empty
        // and is retried after a short pause rather than on every page view.
        console.warn(`[video] lookup for ${gamePk} failed:`, (err as Error).message);
        ttl = 10 * MINUTE;
      }
      lookupCache.set(String(gamePk), body, ttl);
      return body;
    })().finally(() => inflight.delete(gamePk));
    inflight.set(gamePk, pending);
  }
  return pending;
}

export async function handleGameVideo(gamePk: number, res: Response): Promise<void> {
  try {
    const body = await lookup(gamePk);
    if (body === 'not-final') {
      res.status(409).json({ error: 'game is not final' });
      return;
    }
    // A full set is stable; anything less may still fill in once MLB uploads.
    res.set('Cache-Control', `public, max-age=${body.videos.length === 2 ? 86_400 : 900}`);
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
