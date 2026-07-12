import type {
  GamePreviewResponse,
  GamePreviewSide,
  PitcherStartLine,
  ProbablePitcherPreview,
} from '@mlb-scorecards/shared';
import { TtlCache } from '../cache.js';
import { getLiveFeed, getPersonGameLog, getTeams, type RawLiveFeed } from '../mlbApi.js';

const STARTS_WANTED = 5;

// Probables and recent-start lines move slowly; a short TTL keeps the page
// snappy without ever serving a stale scratch (pitcher swap) for long.
const previewCache = new TtlCache<GamePreviewResponse>(50);
const PREVIEW_TTL_MS = 5 * 60 * 1000;

/** "6.2" innings-pitched notation → outs (the .Y digit is outs, 0-2). */
function ipToOuts(ip: string): number {
  const [full, part] = ip.split('.');
  return (Number(full) || 0) * 3 + (Number(part) || 0);
}

function outsToIp(outs: number): string {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

interface LogSplit {
  date?: string;
  isHome?: boolean;
  opponent?: { id?: number; name?: string };
  game?: { gamePk?: number };
  stat?: Record<string, unknown>;
}

function toStartLine(split: LogSplit, abbrById: Map<number, string>): PitcherStartLine {
  const stat = split.stat ?? {};
  const oppId = split.opponent?.id;
  return {
    gamePk: split.game?.gamePk ?? null,
    date: split.date ?? '',
    opponentAbbr: (oppId != null ? abbrById.get(oppId) : undefined) ?? split.opponent?.name ?? '—',
    isHome: Boolean(split.isHome),
    ip: String(stat.inningsPitched ?? '0.0'),
    hits: Number(stat.hits ?? 0),
    runs: Number(stat.runs ?? 0),
    earnedRuns: Number(stat.earnedRuns ?? 0),
    walks: Number(stat.baseOnBalls ?? 0),
    strikeouts: Number(stat.strikeOuts ?? 0),
    homeRuns: Number(stat.homeRuns ?? 0),
    pitches: stat.numberOfPitches != null ? Number(stat.numberOfPitches) : null,
  };
}

async function startsForSeason(pitcherId: number, season: number, abbrById: Map<number, string>): Promise<PitcherStartLine[]> {
  const log = await getPersonGameLog(pitcherId, season, 'pitching');
  const splits = (log.stats?.[0]?.splits ?? []) as LogSplit[];
  return splits
    .filter((s) => Number(s.stat?.gamesStarted ?? 0) >= 1)
    .map((s) => toStartLine(s, abbrById));
}

async function buildProbable(
  probable: { id: number; fullName: string } | undefined,
  raw: RawLiveFeed,
  season: number,
  abbrById: Map<number, string>
): Promise<ProbablePitcherPreview | null> {
  if (!probable) return null;

  let starts = await startsForSeason(probable.id, season, abbrById);
  // Early in a season a starter may not have 5 starts yet - top up from the
  // previous year so the view stays informative in April.
  if (starts.length < STARTS_WANTED) {
    try {
      const prior = await startsForSeason(probable.id, season - 1, abbrById);
      starts = [...prior, ...starts];
    } catch {
      // no prior-season log (rookies) - show what exists
    }
  }
  starts = starts.slice(-STARTS_WANTED).reverse(); // most recent first

  let span: ProbablePitcherPreview['span'] = null;
  if (starts.length > 0) {
    const outs = starts.reduce((s, l) => s + ipToOuts(l.ip), 0);
    const er = starts.reduce((s, l) => s + l.earnedRuns, 0);
    const bbh = starts.reduce((s, l) => s + l.walks + l.hits, 0);
    const k = starts.reduce((s, l) => s + l.strikeouts, 0);
    const ipFrac = outs / 3;
    span = ipFrac > 0
      ? {
          ip: outsToIp(outs),
          era: Math.round(((9 * er) / ipFrac) * 100) / 100,
          whip: Math.round((bbh / ipFrac) * 100) / 100,
          kPer9: Math.round(((9 * k) / ipFrac) * 10) / 10,
        }
      : null;
  }

  return {
    id: probable.id,
    name: probable.fullName,
    hand: raw.gameData.players?.[`ID${probable.id}`]?.pitchHand?.code ?? null,
    starts,
    span,
  };
}

export async function buildGamePreview(gamePk: number): Promise<GamePreviewResponse> {
  const cached = previewCache.get(String(gamePk));
  if (cached) return cached;

  const raw = await getLiveFeed(gamePk);
  const season = Number((raw.gameData.datetime?.officialDate ?? '').slice(0, 4)) || new Date().getFullYear();

  let abbrById = new Map<number, string>();
  try {
    const teams = await getTeams(season);
    abbrById = new Map(teams.teams.filter((t) => t.abbreviation).map((t) => [t.id, t.abbreviation!]));
  } catch {
    // fall back to full opponent names
  }

  const side = (which: 'away' | 'home'): GamePreviewSide['team'] => {
    const box = raw.liveData.boxscore.teams[which].team;
    return {
      id: box.id,
      name: box.name,
      abbreviation: raw.gameData.teams?.[which]?.abbreviation ?? box.abbreviation ?? box.name,
    };
  };

  const [awayProbable, homeProbable] = await Promise.all([
    buildProbable(raw.gameData.probablePitchers?.away, raw, season, abbrById),
    buildProbable(raw.gameData.probablePitchers?.home, raw, season, abbrById),
  ]);

  const body: GamePreviewResponse = {
    gamePk,
    status: {
      abstractGameState: raw.gameData.status.abstractGameState,
      detailedState: raw.gameData.status.detailedState,
    },
    away: { team: side('away'), probable: awayProbable },
    home: { team: side('home'), probable: homeProbable },
  };
  previewCache.set(String(gamePk), body, PREVIEW_TTL_MS);
  return body;
}
