import { Router } from 'express';
import { getSchedule } from '../mlbApi.js';

const router = Router();

// MLB regular-season months (April–September)
const SEASON_MONTHS = [4, 5, 6, 7, 8, 9];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

router.get('/', async (_req, res) => {
  const currentYear = new Date().getFullYear();

  for (let attempt = 0; attempt < 20; attempt++) {
    const year = randomInt(2010, currentYear - 1);
    const month = SEASON_MONTHS[Math.floor(Math.random() * SEASON_MONTHS.length)];
    const day = randomInt(1, 28);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    try {
      const raw = await getSchedule(date);
      const games = raw.dates[0]?.games ?? [];
      const finished = games.filter((g) => g.status.abstractGameState === 'Final');
      if (finished.length > 0) {
        const game = finished[Math.floor(Math.random() * finished.length)];
        res.json({ gamePk: game.gamePk, date });
        return;
      }
    } catch {
      // date had no data — try another
    }
  }

  res.status(503).json({ error: 'Could not find a random game after several attempts' });
});

export default router;
