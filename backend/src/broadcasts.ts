import type { GameWatch } from '@mlb-scorecards/shared';

/** One entry of the schedule's `broadcasts(all)` hydration. */
export interface RawBroadcast {
  name?: string;
  /** 'TV', 'AM', 'FM' or 'INET' (audio). */
  type?: string;
  isNational?: boolean;
  /** Whether MLB carries this feed on its own streaming services. */
  availableForStreaming?: boolean;
  /** MLB.TV's free game of the day. */
  freeGame?: boolean;
}

const MLB_TV = 'MLB.TV';

/**
 * MLB's internal feed names, mapped to where a reader would actually go.
 * "MLB Video" is the Arizona Fall League's free stream on MLB.com.
 */
const STREAM_LABELS: Record<string, string> = {
  'MLB Video': 'MLB.com (free)',
};

/**
 * Where a game can be watched, from the schedule's broadcast list.
 *
 * Each video feed is listed twice (home and away), and only one of the pair
 * carries the streaming flag, so feeds are merged by name first. In the majors
 * a streamable regional feed means the game is on MLB.TV for viewers outside
 * both clubs' home markets; everywhere else the feed's own name is the service.
 *
 * Returns null when MLB lists no video feed at all, which is the case for
 * leagues whose rights it doesn't hold: unknown, not "unavailable".
 */
export function watchInfo(broadcasts: RawBroadcast[] | undefined, level: number): GameWatch | null {
  const feeds = new Map<string, { national: boolean; streamable: boolean; free: boolean }>();
  for (const b of broadcasts ?? []) {
    const name = b.name?.trim();
    if (b.type !== 'TV' || !name) continue;
    const feed = feeds.get(name) ?? { national: false, streamable: false, free: false };
    feed.national ||= Boolean(b.isNational);
    feed.streamable ||= Boolean(b.availableForStreaming);
    feed.free ||= Boolean(b.freeGame);
    feeds.set(name, feed);
  }
  if (feeds.size === 0) return null;

  const national: string[] = [];
  const other: string[] = [];
  const tv: string[] = [];
  let outOfMarket = false;
  let free = false;

  for (const [name, feed] of feeds) {
    if (!feed.streamable) {
      // A national channel with no stream is still worth naming; a regional
      // one only helps viewers who already know their local channel.
      if (feed.national) tv.push(name);
      continue;
    }
    free ||= feed.free;
    if (level === 1 && !feed.national) outOfMarket = true;
    else (feed.national ? national : other).push(STREAM_LABELS[name] ?? name);
  }

  const streams = [...national, ...other];
  if (outOfMarket && !streams.includes(MLB_TV)) {
    streams.push(free ? `${MLB_TV} (free game)` : `${MLB_TV} (out of market)`);
  }
  return { streams, tv };
}
