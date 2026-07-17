import { Router } from 'express';
import type { DailyStarLine, DailyStarsResponse } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getLiveFeed, getSchedule, type RawLiveFeed, type RawScheduleGame } from '../mlbApi.js';
import { buildPredictive } from '../scorecard/predictive.js';

const router = Router();

const MIN_PA = 3;
const MIN_PITCHES = 40;
const TOP_N = 3;
const CONCURRENCY = 6;

// A finished day's stars never change; the current day's are still forming.
const cache = new TtlCache<DailyStarsResponse>(20);
const DONE_TTL_MS = 24 * 60 * 60 * 1000;
const LIVE_TTL_MS = 5 * 60 * 1000;

function batterLine(feed: RawLiveFeed, side: 'away' | 'home', id: number): string {
  const stat = feed.liveData.boxscore.teams[side].players[`ID${id}`]?.stats?.batting;
  if (!stat) return '';
  const parts = [`${stat.hits ?? 0}-for-${stat.atBats ?? 0}`];
  if (stat.homeRuns) parts.push(stat.homeRuns > 1 ? `${stat.homeRuns} HR` : 'HR');
  if (stat.rbi) parts.push(`${stat.rbi} RBI`);
  return parts.join(', ');
}

function pitcherLine(feed: RawLiveFeed, side: 'away' | 'home', id: number): string {
  const stat = feed.liveData.boxscore.teams[side].players[`ID${id}`]?.stats?.pitching;
  if (!stat) return '';
  return `${stat.inningsPitched ?? '0.0'} IP, ${stat.strikeOuts ?? 0} K, ${stat.earnedRuns ?? 0} ER`;
}

function replayPickFrom(finals: RawScheduleGame[]): DailyStarsResponse['replayPick'] {
  let best: { game: RawScheduleGame; score: number; reason: string } | null = null;
  for (const g of finals) {
    const away = g.teams.away.score ?? 0;
    const home = g.teams.home.score ?? 0;
    const innings = g.linescore?.innings ?? [];
    const margin = Math.abs(away - home);

    const lastHome = innings.at(-1)?.home?.runs ?? 0;
    const walkOff = home > away && lastHome > 0 && home - lastHome <= away;
    const extras = innings.length > 9;

    let score = 0;
    let reason = '';
    if (walkOff) {
      score = 100 + (extras ? 10 : 0);
      reason = extras ? `Walk-off in ${innings.length}` : 'Walk-off finish';
    } else if (extras) {
      score = 50 + innings.length;
      reason = `${innings.length} innings`;
    } else if (margin <= 1) {
      score = 25;
      reason = 'One-run game';
    } else {
      continue;
    }
    if (!best || score > best.score) best = { game: g, score, reason };
  }
  if (!best) return null;
  const g = best.game;
  return {
    gamePk: g.gamePk,
    awayAbbr: g.teams.away.team.abbreviation ?? g.teams.away.team.name,
    homeAbbr: g.teams.home.team.abbreviation ?? g.teams.home.team.name,
    awayScore: g.teams.away.score ?? 0,
    homeScore: g.teams.home.score ?? 0,
    reason: best.reason,
  };
}

async function buildDailyStars(date: string, isPastDate: boolean): Promise<DailyStarsResponse> {
  const schedule = await getSchedule(date);
  const finals = (schedule.dates[0]?.games ?? []).filter(
    (g) => g.status.abstractGameState === 'Final'
  );

  const batters: DailyStarLine[] = [];
  const pitchers: DailyStarLine[] = [];

  let cursor = 0;
  async function worker() {
    while (cursor < finals.length) {
      const g = finals[cursor++];
      try {
        const feed = await getLiveFeed(g.gamePk);
        const predictive = buildPredictive(feed);
        for (const side of ['away', 'home'] as const) {
          const abbr =
            feed.gameData.teams?.[side]?.abbreviation ??
            feed.liveData.boxscore.teams[side].team.abbreviation ??
            '';
          for (const b of predictive[side].batters) {
            if (b.pa < MIN_PA) continue;
            batters.push({
              playerId: b.id,
              name: b.name,
              teamAbbr: abbr,
              gamePk: g.gamePk,
              index: b.dmg,
              line: batterLine(feed, side, b.id),
            });
          }
          for (const p of predictive[side].pitchers) {
            if (p.pitches < MIN_PITCHES) continue;
            pitchers.push({
              playerId: p.id,
              name: p.name,
              teamAbbr: abbr,
              gamePk: g.gamePk,
              index: p.dom,
              line: pitcherLine(feed, side, p.id),
            });
          }
        }
      } catch {
        // one bad feed never sinks the strip
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  batters.sort((a, b) => b.index - a.index);
  pitchers.sort((a, b) => b.index - a.index);

  const body: DailyStarsResponse = {
    date,
    batters: batters.slice(0, TOP_N),
    pitchers: pitchers.slice(0, TOP_N),
    replayPick: replayPickFrom(finals),
  };
  cache.set(date, body, isPastDate ? DONE_TTL_MS : LIVE_TTL_MS);
  return body;
}

router.get('/', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'query param "date" is required as YYYY-MM-DD' });
    return;
  }

  const cached = cache.get(date);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const todayUtc = new Date().toISOString().slice(0, 10);
    res.json(await buildDailyStars(date, date < todayUtc));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
