import { Router } from 'express';
import type {
  PitchTypePerformance,
  PlayerProfileResponse,
  PlayerProfileSide,
} from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { setShortCache } from '../http.js';
import {
  getByMonth,
  getHotColdZones,
  getPerson,
  getPitchArsenal,
  getPitchLog,
  getPlayLog,
  getStatSplits,
} from '../mlbApi.js';
import { buildPitchTypePerformance } from '../player/pitchTypes.js';
import { buildArsenal, buildSplits, buildTrend, buildZones, hasProfileData } from '../player/profile.js';

const router = Router();

/**
 * The per-pitch logs behind this are ~1.3 MB each and are never cached raw.
 * Their *derived* summary is a handful of small objects, so caching that gives
 * repeat views the same speed-up at a tiny fraction of the memory.
 */
const PITCH_TYPE_TTL_MS = 10 * 60_000;
const pitchTypeCache = new TtlCache<Map<string, PitchTypePerformance>>(200);

async function pitchTypePerformance(
  id: number,
  season: number,
  group: 'hitting' | 'pitching'
): Promise<Map<string, PitchTypePerformance> | undefined> {
  const key = `${id}:${season}:${group}`;
  const cached = pitchTypeCache.get(key);
  if (cached) return cached;

  const [playLog, pitchLog] = await Promise.all([
    getPlayLog(id, season, group).catch(() => null),
    getPitchLog(id, season, group).catch(() => null),
  ]);
  if (!playLog || !pitchLog) return undefined;

  const performance = buildPitchTypePerformance(playLog, pitchLog);
  pitchTypeCache.set(key, performance, PITCH_TYPE_TTL_MS);
  return performance;
}

/**
 * Every request here hits MLB's own pre-aggregated season endpoints, so a full
 * profile is four small calls per side rather than one ~1 MB live feed per game
 * the player appeared in. A side that comes back empty is reported as null.
 */
async function buildSide(id: number, season: number, group: 'hitting' | 'pitching'): Promise<PlayerProfileSide | null> {
  // One failing sub-request shouldn't blank the whole profile — take what we get.
  const [rawArsenal, zones, splits, trend, performance] = await Promise.all([
    getPitchArsenal(id, season, group).catch(() => ({})),
    getHotColdZones(id, season, group).then(buildZones, () => []),
    getStatSplits(id, season, group, 'vl,vr').then((r) => buildSplits(r, group), () => []),
    getByMonth(id, season, group).then((r) => buildTrend(r, group), () => []),
    pitchTypePerformance(id, season, group),
  ]);

  // Results-by-pitch-type are joined onto the arsenal by pitch code. If the
  // per-pitch logs are unavailable the usage bars still render, just without
  // the performance columns.
  const arsenal = buildArsenal(rawArsenal, performance);

  const side: PlayerProfileSide = { arsenal, zones, splits, trend };
  return hasProfileData(side) ? side : null;
}

router.get('/:id/profile', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const season = parseInt(String(req.query.season ?? new Date().getFullYear()), 10);
  if (!Number.isFinite(id) || !Number.isFinite(season)) {
    res.status(400).json({ error: 'invalid player id or season' });
    return;
  }

  try {
    const [person, batting, pitching] = await Promise.all([
      getPerson(id),
      buildSide(id, season, 'hitting'),
      buildSide(id, season, 'pitching'),
    ]);
    const info = person.people?.[0];
    if (!info) {
      res.status(404).json({ error: 'player not found' });
      return;
    }

    const body: PlayerProfileResponse = {
      id,
      name: info.fullName,
      position: info.primaryPosition?.abbreviation ?? null,
      team: info.currentTeam?.name ?? null,
      bats: info.batSide?.code ?? null,
      throws: info.pitchHand?.code ?? null,
      season,
      batting,
      pitching,
    };
    // Season aggregates move at most once per game; a few minutes is safe.
    setShortCache(res, 300);
    res.json(body);
  } catch (err) {
    const message = (err as Error).message;
    // An unknown id 404s upstream; report that as "not found" rather than as a
    // bad gateway, which would suggest MLB is down.
    res.status(message.includes('-> 404') ? 404 : 502).json({ error: message });
  }
});

export default router;
