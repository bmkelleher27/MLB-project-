import { Router } from 'express';
import type { GameAtBatsResponse, Scorecard } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getLiveFeed } from '../mlbApi.js';
import { buildGameAtBats } from '../scorecard/atbats.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const router = Router();

// A Final game's feed is immutable, but the raw feed is ~1 MB — too big to
// keep many of. Cache the small *transformed* responses instead (a scorecard
// is ~30-60 KB, an at-bats body ~100-200 KB), so repeat views of recently
// finished games skip both the MLB round-trip and the transform. Live and
// Preview games are never cached here; they must stay fresh.
const FINAL_TTL_MS = 6 * 60 * 60 * 1000;
const scorecardCache = new TtlCache<Scorecard>(100);
const atBatsCache = new TtlCache<GameAtBatsResponse>(50);

router.get('/:gamePk/scorecard', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return;
  }

  const cached = scorecardCache.get(String(gamePk));
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    const scorecard = transformLiveFeed(raw);
    if (scorecard.status.abstractGameState === 'Final') {
      scorecardCache.set(String(gamePk), scorecard, FINAL_TTL_MS);
    }
    res.json(scorecard);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get('/:gamePk/atbats', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return;
  }

  const cached = atBatsCache.get(String(gamePk));
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    const body = buildGameAtBats(raw, gamePk);
    if (body.status.abstractGameState === 'Final') {
      atBatsCache.set(String(gamePk), body, FINAL_TTL_MS);
    }
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
