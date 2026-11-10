import type { Response } from 'express';
import type { GameVideo, GameVideoResponse } from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getScheduleGame, type RawScheduleGame } from '../mlbApi.js';
import { channelSearchUrl, HIGHLIGHT_WINDOW, pickVideos, type SearchItem, type VideoGame } from '../video/match.js';
import { MLB_CHANNEL_ID, officialChannelIds, searchVideos, YouTubeQuotaError, youtubeApiKey } from '../video/youtube.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Lookups by gamePk. A found video is stable, so hits are kept for a month. A
 * miss on a recent game is retried after a few hours, because MLB's highlights
 * can still be on their way; a miss on an old game is unlikely to change.
 */
const lookupCache = new TtlCache<GameVideoResponse>(2_000);
const inflight = new Map<number, Promise<GameVideoResponse>>();

function toVideoGame(g: RawScheduleGame): VideoGame {
  return {
    gameDate: g.gameDate,
    officialDate: g.officialDate ?? g.gameDate.slice(0, 10),
    gameType: g.gameType ?? 'R',
    doubleHeader: g.doubleHeader ?? 'N',
    gameNumber: g.gameNumber ?? 1,
    away: { name: g.teams.away.team.name, teamName: g.teams.away.team.teamName },
    home: { name: g.teams.home.team.name, teamName: g.teams.home.team.teamName },
  };
}

function clubLabel(t: VideoGame['away']): string {
  return t.teamName ?? t.name;
}

async function findVideos(game: VideoGame, key: string): Promise<GameVideo[]> {
  const channels = await officialChannelIds(key);
  const official = new Set(channels);
  const start = Date.parse(game.gameDate);
  const matchup = `${clubLabel(game.away)} ${clubLabel(game.home)}`;

  // Two searches, run together:
  //  1. MLB's channel in the days after the game: its "Official Full Game
  //     Highlights" (and the rare same-week full broadcast).
  //  2. Full games on any official channel, at any date — MLB Vault posts
  //     classic games years later. Searched without a channel filter so one
  //     call covers every official channel; the results are filtered to those
  //     channels below, so a third-party upload can never get through.
  const [recent, full] = await Promise.all([
    searchVideos(
      {
        query: matchup,
        channelId: MLB_CHANNEL_ID,
        publishedAfter: new Date(start - HIGHLIGHT_WINDOW.beforeMs).toISOString(),
        publishedBefore: new Date(start + HIGHLIGHT_WINDOW.afterMs).toISOString(),
      },
      key
    ),
    searchVideos(
      { query: `${matchup} full game ${game.officialDate.slice(0, 4)}`, maxResults: 50 },
      key
    ),
  ]);

  const items: SearchItem[] = [...recent, ...full].filter((item) => official.has(item.channelId));
  return pickVideos(items, game).map(({ kind, videoId, title, channelTitle, publishedAt }) => ({
    kind,
    videoId,
    title,
    channelTitle,
    publishedAt,
  }));
}

async function lookup(gamePk: number): Promise<GameVideoResponse | 'not-final'> {
  const schedule = await getScheduleGame(gamePk);
  const raw = schedule.dates?.flatMap((d) => d.games).find((g) => g.gamePk === gamePk);
  if (!raw) throw new Error('game not found');
  if (raw.status.abstractGameState !== 'Final') return 'not-final';

  const game = toVideoGame(raw);
  const searchUrl = channelSearchUrl(game);
  const key = youtubeApiKey();
  if (!key) return { gamePk, videos: [], searchUrl, lookup: 'disabled' };

  const cached = lookupCache.get(String(gamePk));
  if (cached) return cached;

  let pending = inflight.get(gamePk);
  if (!pending) {
    pending = (async () => {
      let videos: GameVideo[] = [];
      let ttl: number;
      try {
        videos = await findVideos(game, key);
        const recent = Date.now() - Date.parse(game.gameDate) < 7 * DAY;
        ttl = videos.length > 0 ? 30 * DAY : recent ? 3 * HOUR : 7 * DAY;
      } catch (err) {
        // A failed or over-quota search still answers with the search link,
        // and is retried after a short pause rather than on every page view.
        console.warn(`[youtube] lookup for ${gamePk} failed:`, (err as Error).message);
        ttl = err instanceof YouTubeQuotaError ? 2 * HOUR : 10 * 60_000;
      }
      const body: GameVideoResponse = { gamePk, videos, searchUrl, lookup: 'youtube' };
      lookupCache.set(String(gamePk), body, ttl);
      return body;
    })().finally(() => inflight.delete(gamePk));
    inflight.set(gamePk, pending);
  }
  return pending;
}

export async function handleGameVideo(gamePk: number, res: Response): Promise<void> {
  try {
    const body = await lookup(gamePk);
    if (body === 'not-final') {
      res.status(409).json({ error: 'game is not final' });
      return;
    }
    // Hits are stable; a miss may turn into a hit once MLB uploads, so it is
    // reused only briefly.
    res.set('Cache-Control', `public, max-age=${body.videos.length > 0 ? 86_400 : 900}`);
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
}
