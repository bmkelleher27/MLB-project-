import { Router, type Response } from 'express';
import { setGameStateCache } from '../http.js';
import { loadAtBats, loadScorecard } from '../scorecard/gameStore.js';
import { handleGameVideo } from './gameVideo.js';
import { buildGamePreview } from './preview.js';

const router = Router();

/** Parses the :gamePk param, answering 400 itself when it isn't an integer. */
function parseGamePk(raw: string, res: Response): number | null {
  const gamePk = Number(raw);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return null;
  }
  return gamePk;
}

router.get('/:gamePk/scorecard', async (req, res) => {
  const gamePk = parseGamePk(req.params.gamePk, res);
  if (gamePk === null) return;

  try {
    const scorecard = await loadScorecard(gamePk);
    setGameStateCache(res, scorecard.status.abstractGameState);
    res.json(scorecard);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get('/:gamePk/atbats', async (req, res) => {
  const gamePk = parseGamePk(req.params.gamePk, res);
  if (gamePk === null) return;

  try {
    const body = await loadAtBats(gamePk);
    setGameStateCache(res, body.status.abstractGameState);
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

router.get('/:gamePk/preview', async (req, res) => {
  const gamePk = parseGamePk(req.params.gamePk, res);
  if (gamePk === null) return;

  try {
    const preview = await buildGamePreview(gamePk);
    // Pregame stats (probables, recent form) shift slowly; a minute is plenty.
    setGameStateCache(res, 'Preview');
    res.json(preview);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Official YouTube video for a finished game: full broadcast if MLB has posted
// one, otherwise MLB's full-game highlights. 409 for games not yet Final.
router.get('/:gamePk/video', async (req, res) => {
  const gamePk = parseGamePk(req.params.gamePk, res);
  if (gamePk === null) return;
  await handleGameVideo(gamePk, res);
});

export default router;
