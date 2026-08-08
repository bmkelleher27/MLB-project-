import { Router } from 'express';
import type { ScheduleGame, ScheduleResponse } from '@mlb-scorecards/shared';
import { setShortCache } from '../http.js';
import { parseLevel } from '../levels.js';
import { getSchedule } from '../mlbApi.js';

const router = Router();

router.get('/', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'query param "date" is required as YYYY-MM-DD' });
    return;
  }
  const level = parseLevel(req.query.level);
  if (level === null) {
    res.status(400).json({ error: 'query param "level" is not a supported level' });
    return;
  }

  try {
    const raw = await getSchedule(date, level);
    const rawGames = raw.dates[0]?.games ?? [];
    const games: ScheduleGame[] = rawGames.map((g) => ({
      gamePk: g.gamePk,
      gameDate: g.gameDate,
      status: { abstractGameState: g.status.abstractGameState, detailedState: g.status.detailedState },
      inning: g.linescore?.currentInning ?? null,
      inningState: g.linescore?.inningState ?? null,
      away: {
        id: g.teams.away.team.id,
        name: g.teams.away.team.name,
        abbreviation: g.teams.away.team.abbreviation ?? g.teams.away.team.name,
        score: g.teams.away.score ?? null,
        probablePitcher: g.teams.away.probablePitcher?.fullName ?? null,
      },
      home: {
        id: g.teams.home.team.id,
        name: g.teams.home.team.name,
        abbreviation: g.teams.home.team.abbreviation ?? g.teams.home.team.name,
        score: g.teams.home.score ?? null,
        probablePitcher: g.teams.home.probablePitcher?.fullName ?? null,
      },
      venue: g.venue?.name ?? null,
      linescore: g.linescore?.innings?.map((inn) => ({
        num: inn.num,
        away: inn.away?.runs ?? null,
        home: inn.home?.runs ?? null,
      })) ?? null,
      hits:
        g.linescore?.teams?.away?.hits != null && g.linescore?.teams?.home?.hits != null
          ? { away: g.linescore.teams.away.hits, home: g.linescore.teams.home.hits }
          : null,
      situation:
        g.status.abstractGameState === 'Live'
          ? {
              outs: g.linescore?.outs ?? 0,
              onFirst: Boolean(g.linescore?.offense?.first),
              onSecond: Boolean(g.linescore?.offense?.second),
              onThird: Boolean(g.linescore?.offense?.third),
              batter: g.linescore?.offense?.batter?.fullName ?? null,
              pitcher: g.linescore?.defense?.pitcher?.fullName ?? null,
            }
          : null,
    }));
    const response: ScheduleResponse = { date, level, games };
    // The frontend polls this every 30s; a short shared cache absorbs bursts of
    // viewers hitting the same date without going stale enough to matter.
    setShortCache(res, 15);
    res.json(response);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
