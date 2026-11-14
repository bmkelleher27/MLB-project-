import type { GameVideo } from '@mlb-scorecards/shared';

/** The parts of `/api/v1/game/{gamePk}/content` this module reads. */
export interface RawGameContent {
  media?: {
    /** MLB's post-game packages: "Extended Highlights" (condensed game) and "Daily Recap". */
    epgAlternate?: Array<{ title?: string; items?: RawContentVideo[] }>;
  };
}

export interface RawContentVideo {
  type?: string;
  date?: string;
  slug?: string;
  headline?: string;
  title?: string;
  /** "HH:MM:SS". */
  duration?: string;
  keywordsAll?: Array<{ type?: string; value?: string }>;
  image?: { cuts?: Array<{ aspectRatio?: string; width?: number; src?: string }> };
  playbacks?: Array<{ name?: string; url?: string }>;
}

const KIND_BY_GROUP: Record<string, GameVideo['kind']> = {
  'Extended Highlights': 'condensed',
  'Daily Recap': 'recap',
};

const KIND_BY_KEYWORD: Record<string, GameVideo['kind']> = {
  condensed_game: 'condensed',
  mlb_recap: 'recap',
};

/** Condensed game first: it is the closest thing to watching the game. */
const ORDER: GameVideo['kind'][] = ['condensed', 'recap'];

/** Width the poster is requested at; the player is at most 760px wide. */
const POSTER_WIDTH = 960;

/**
 * Only MLB's own hosts are passed to the browser, so a surprising payload can
 * never make the page load media or images from somewhere else.
 */
function mlbUrl(raw: string | undefined, hostSuffixes: string[]): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return hostSuffixes.some((s) => url.hostname === s || url.hostname.endsWith(`.${s}`)) ? url.toString() : null;
  } catch {
    return null;
  }
}

function durationSeconds(raw: string | undefined): number | null {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(raw ?? '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function poster(video: RawContentVideo): string | null {
  const wide = (video.image?.cuts ?? []).filter((c) => c.aspectRatio === '16:9' && c.src && c.width);
  // The smallest cut that still fills the player, else the largest there is.
  wide.sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const cut = wide.find((c) => (c.width ?? 0) >= POSTER_WIDTH) ?? wide.at(-1);
  return mlbUrl(cut?.src, ['mlbstatic.com']);
}

function kindOf(video: RawContentVideo, groupTitle: string | undefined): GameVideo['kind'] | null {
  const byGroup = groupTitle ? KIND_BY_GROUP[groupTitle] : undefined;
  if (byGroup) return byGroup;
  for (const k of video.keywordsAll ?? []) {
    if (k.type === 'mlbtax' && k.value && KIND_BY_KEYWORD[k.value]) return KIND_BY_KEYWORD[k.value];
  }
  return null;
}

/**
 * MLB's own post-game videos for a game: the condensed game (about ten
 * minutes) and the short recap, as plain MP4s the browser can play directly.
 * Empty when MLB produced neither, which is the norm outside the majors.
 */
export function pickGameVideos(content: RawGameContent | undefined): GameVideo[] {
  const found = new Map<GameVideo['kind'], GameVideo>();
  for (const group of content?.media?.epgAlternate ?? []) {
    for (const item of group.items ?? []) {
      const kind = kindOf(item, group.title);
      if (!kind || found.has(kind)) continue;
      const url = mlbUrl(item.playbacks?.find((p) => p.name === 'mp4Avc')?.url, ['mlb.com']);
      if (!url) continue;
      found.set(kind, {
        kind,
        title: item.headline ?? item.title ?? '',
        durationSeconds: durationSeconds(item.duration),
        url,
        poster: poster(item),
        pageUrl: item.slug ? `https://www.mlb.com/video/${encodeURIComponent(item.slug)}` : null,
        publishedAt: item.date ?? null,
      });
    }
  }
  return ORDER.flatMap((kind) => found.get(kind) ?? []);
}
