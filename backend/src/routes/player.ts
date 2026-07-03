import { Router } from 'express';
import type { BattingLogEntry, PitchingLogEntry, PlayerLogResponse } from '@mlb-scorecards/shared';
import { getPerson, getPersonGameLog } from '../mlbApi.js';

const router = Router();

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

router.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const season = parseInt(String(req.query.season ?? new Date().getFullYear()), 10);
  if (!Number.isFinite(id) || !Number.isFinite(season)) {
    res.status(400).json({ error: 'invalid player id or season' });
    return;
  }
  try {
    const [person, hitting, pitching] = await Promise.all([
      getPerson(id),
      getPersonGameLog(id, season, 'hitting'),
      getPersonGameLog(id, season, 'pitching'),
    ]);
    const info = person.people?.[0];
    if (!info) {
      res.status(404).json({ error: 'player not found' });
      return;
    }

    const batting: BattingLogEntry[] = (hitting.stats?.[0]?.splits ?? []).map((s) => ({
      date: s.date ?? '',
      gamePk: s.game?.gamePk ?? null,
      opponent: s.opponent?.name ?? '',
      isHome: s.isHome ?? false,
      atBats: num(s.stat?.atBats),
      hits: num(s.stat?.hits),
      homeRuns: num(s.stat?.homeRuns),
      rbi: num(s.stat?.rbi),
      walks: num(s.stat?.baseOnBalls),
      strikeouts: num(s.stat?.strikeOuts),
      avg: String(s.stat?.avg ?? ''),
    }));

    const pitchingLog: PitchingLogEntry[] = (pitching.stats?.[0]?.splits ?? []).map((s) => ({
      date: s.date ?? '',
      gamePk: s.game?.gamePk ?? null,
      opponent: s.opponent?.name ?? '',
      isHome: s.isHome ?? false,
      inningsPitched: String(s.stat?.inningsPitched ?? '0.0'),
      hits: num(s.stat?.hits),
      earnedRuns: num(s.stat?.earnedRuns),
      walks: num(s.stat?.baseOnBalls),
      strikeouts: num(s.stat?.strikeOuts),
    }));

    const body: PlayerLogResponse = {
      id,
      name: info.fullName,
      position: info.primaryPosition?.abbreviation ?? null,
      team: info.currentTeam?.name ?? null,
      season,
      batting,
      pitching: pitchingLog,
    };
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
