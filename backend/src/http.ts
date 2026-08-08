import type { Response } from 'express';

/**
 * Set a Cache-Control header appropriate to a game's mutability so browsers and
 * any CDN/proxy in front of the API can reuse responses safely:
 *  - Final  → immutable feed; cache for hours, serve stale while revalidating.
 *  - Live   → changes constantly (the socket is the real-time path); only a few
 *             seconds of caching to smooth reload bursts.
 *  - other  → Preview/Postponed etc; a short window catches lineup/probable edits.
 */
export function setGameStateCache(res: Response, abstractGameState: string): void {
  if (abstractGameState === 'Final') {
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  } else if (abstractGameState === 'Live') {
    res.set('Cache-Control', 'public, max-age=5');
  } else {
    res.set('Cache-Control', 'public, max-age=60');
  }
}

/** Fixed short cache for a list of games whose freshness needn't be second-perfect. */
export function setShortCache(res: Response, seconds: number): void {
  res.set('Cache-Control', `public, max-age=${seconds}`);
}
