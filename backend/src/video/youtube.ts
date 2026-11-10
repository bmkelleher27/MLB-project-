import { TtlCache } from '../cache.js';
import type { SearchItem } from './match.js';

/**
 * Thin YouTube Data API v3 client, limited to MLB's own channels.
 *
 * Only official uploads are ever returned: complete games on YouTube are mostly
 * re-uploads by third parties, and those are not something this app should
 * link to or embed.
 *
 * Quota: the free daily allowance is 10,000 units, and one search costs 100.
 * A game lookup makes two searches, so results are cached hard (see
 * lookupCache in the route) and lookups only run for finished games.
 */

const API = 'https://www.googleapis.com/youtube/v3';
const FETCH_TIMEOUT_MS = 8_000;

/** MLB's main channel (youtube.com/@MLB): highlights, and some full classic games. */
export const MLB_CHANNEL_ID = 'UCoLrcjPV5PbUrUyXq5mjc_A';
/** Handles of further official channels, resolved to ids on first use. */
const EXTRA_HANDLES = ['@MLBVault'];

export function youtubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  return key ? key : null;
}

export class YouTubeQuotaError extends Error {}

interface RawSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
  }>;
}

interface RawChannelsResponse {
  items?: Array<{ id?: string }>;
}

async function call<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const qs = new URLSearchParams({ ...params, key });
  let res: Response;
  try {
    res = await fetch(`${API}/${path}?${qs}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`YouTube request failed: ${path} -> ${(err as Error).message}`);
  }
  if (!res.ok) {
    // The key travels in the query string, so the URL is never logged.
    const body = await res.text().catch(() => '');
    if (res.status === 403 && /quota/i.test(body)) throw new YouTubeQuotaError('YouTube quota exhausted');
    throw new Error(`YouTube request failed: ${path} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Channel ids are permanent, so a resolved handle is kept for the process's life. */
const channelIds = new TtlCache<string>(16);
const DAY = 24 * 3_600_000;

async function resolveHandle(handle: string, key: string): Promise<string | null> {
  const cached = channelIds.get(handle);
  if (cached) return cached;
  const body = await call<RawChannelsResponse>('channels', { part: 'id', forHandle: handle }, key);
  const id = body.items?.[0]?.id ?? null;
  if (id) channelIds.set(handle, id, 30 * DAY);
  return id;
}

/** Every official channel id; a handle that fails to resolve is skipped, not fatal. */
export async function officialChannelIds(key: string): Promise<string[]> {
  const extra = await Promise.all(
    EXTRA_HANDLES.map((h) =>
      resolveHandle(h, key).catch((err) => {
        if (err instanceof YouTubeQuotaError) throw err;
        console.warn(`[youtube] could not resolve ${h}:`, (err as Error).message);
        return null;
      })
    )
  );
  return [MLB_CHANNEL_ID, ...extra.filter((id): id is string => id !== null)];
}

function toItems(body: RawSearchResponse): SearchItem[] {
  return (body.items ?? []).flatMap((item) => {
    const s = item.snippet;
    const videoId = item.id?.videoId;
    if (!videoId || !s?.title || !s.channelId) return [];
    return [
      {
        videoId,
        title: decodeEntities(s.title),
        description: decodeEntities(s.description ?? ''),
        channelId: s.channelId,
        channelTitle: s.channelTitle ?? '',
        publishedAt: s.publishedAt ?? '',
      },
    ];
  });
}

/** The search API returns HTML-escaped titles ("A&#39;s vs. Rangers"). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export interface SearchOptions {
  query: string;
  channelId?: string;
  publishedAfter?: string;
  publishedBefore?: string;
  maxResults?: number;
}

export async function searchVideos(opts: SearchOptions, key: string): Promise<SearchItem[]> {
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    q: opts.query,
    maxResults: String(opts.maxResults ?? 15),
    // Embeddable only: a match the player refuses to show is worse than none.
    videoEmbeddable: 'true',
  };
  if (opts.channelId) params.channelId = opts.channelId;
  if (opts.publishedAfter) params.publishedAfter = opts.publishedAfter;
  if (opts.publishedBefore) params.publishedBefore = opts.publishedBefore;
  return toItems(await call<RawSearchResponse>('search', params, key));
}
