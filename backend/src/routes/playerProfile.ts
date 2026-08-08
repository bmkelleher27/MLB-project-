import { Router } from 'express';
import type {
  PitchTypePerformance,
  PlayerProfileResponse,
  PlayerProfileSide,
} from '@mlb-scorecards/shared';
import { LEVELS } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { setShortCache } from '../http.js';
import { parseLevel } from '../levels.js';
import {
  getByMonth,
  getHotColdZones,
  getPerson,
  getPitchArsenal,
  getPitchLog,
  getPlayLog,
  getPersonSeasonStats,
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
  group: 'hitting' | 'pitching',
  level: number
): Promise<Map<string, PitchTypePerformance> | undefined> {
  const key = `${id}:${season}:${group}:${level}`;
  const cached = pitchTypeCache.get(key);
  if (cached) return cached;

  const [playLog, pitchLog] = await Promise.all([
    getPlayLog(id, season, group, level).catch(() => null),
    getPitchLog(id, season, group, level).catch(() => null),
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
const LEVELS_TTL_MS = 30 * 60_000;
const levelsCache = new TtlCache<PlayerProfileResponse['availableLevels']>(300);

/**
 * Which levels this player actually appeared at in a season.
 *
 * MLB has no single endpoint for this, so each supported level is probed with
 * the small season-totals call and the ones with games are kept. Six tiny
 * parallel requests, cached for half an hour — cheap enough to run on every
 * profile load, and it means the UI only offers levels that have data.
 */
async function discoverLevels(
  id: number,
  season: number
): Promise<PlayerProfileResponse['availableLevels']> {
  const key = `${id}:${season}`;
  const cached = levelsCache.get(key);
  if (cached) return cached;

  const found = await Promise.all(
    LEVELS.map(async (level) => {
      const games = await Promise.all(
        (['hitting', 'pitching'] as const).map(async (group) => {
          try {
            const raw = await getPersonSeasonStats(id, season, group, level.id);
            const stat = raw.stats?.[0]?.splits?.[0]?.stat;
            return Number(stat?.gamesPlayed ?? 0) || 0;
          } catch {
            return 0;
          }
        })
      );
      // A two-way player's hitting and pitching game counts overlap, so the
      // larger of the two is the honest "appeared in N games" figure.
      return { id: level.id, abbreviation: level.abbreviation, games: Math.max(...games) };
    })
  );

  const levels = found.filter((l) => l.games > 0);
  levelsCache.set(key, levels, LEVELS_TTL_MS);
  return levels;
}

async function buildSide(
  id: number,
  season: number,
  group: 'hitting' | 'pitching',
  level: number
): Promise<PlayerProfileSide | null> {
  // One failing sub-request shouldn't blank the whole profile — take what we get.
  const [rawArsenal, zones, splits, trend, performance] = await Promise.all([
    getPitchArsenal(id, season, group, level).catch(() => ({})),
    getHotColdZones(id, season, group, level).then(buildZones, () => []),
    getStatSplits(id, season, group, 'vl,vr', level).then((r) => buildSplits(r, group), () => []),
    getByMonth(id, season, group, level).then((r) => buildTrend(r, group), () => []),
    pitchTypePerformance(id, season, group, level),
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

  const level = parseLevel(req.query.level);
  if (level === null) {
    res.status(400).json({ error: 'query param "level" is not a supported level' });
    return;
  }

  try {
    // Levels are resolved first: a reader browsing Triple-A who opens a player
    // who never played there should see that player's actual level, not an
    // empty page explaining Triple-A tracking.
    const [person, availableLevels] = await Promise.all([
      getPerson(id),
      discoverLevels(id, season).catch(() => []),
    ]);
    const info = person.people?.[0];
    if (!info) {
      res.status(404).json({ error: 'player not found' });
      return;
    }

    // Honour the requested level when the player has games there; otherwise
    // fall back to wherever they played most that season.
    const requested = availableLevels.find((l) => l.id === level);
    const busiest = availableLevels.reduce<(typeof availableLevels)[number] | null>(
      (best, l) => (best == null || l.games > best.games ? l : best),
      null
    );
    const effectiveLevel = requested ? level : (busiest?.id ?? level);

    const [batting, pitching] = await Promise.all([
      buildSide(id, season, 'hitting', effectiveLevel),
      buildSide(id, season, 'pitching', effectiveLevel),
    ]);

    const body: PlayerProfileResponse = {
      id,
      name: info.fullName,
      position: info.primaryPosition?.abbreviation ?? null,
      team: info.currentTeam?.name ?? null,
      bats: info.batSide?.code ?? null,
      throws: info.pitchHand?.code ?? null,
      season,
      level: effectiveLevel,
      availableLevels,
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
