import { Router } from 'express';
import { getLiveFeed } from '../mlbApi.js';
import { buildGameAtBats } from '../scorecard/atbats.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const router = Router();

router.get('/:gamePk/scorecard', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    res.json(transformLiveFeed(raw));
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

  try {
    const raw = await getLiveFeed(gamePk);
    res.json(buildGameAtBats(raw, gamePk));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
