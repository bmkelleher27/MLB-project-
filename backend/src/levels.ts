import { DEFAULT_LEVEL_ID, isLevelId, type LevelId } from '@mlb-scorecards/shared';

/**
 * Reads a `level` (MLB sportId) query param, falling back to the majors.
 * Anything not in the supported list is rejected rather than passed upstream,
 * so a caller can't use this to proxy arbitrary sports.
 */
export function parseLevel(raw: unknown): LevelId | null {
  if (raw == null || raw === '') return DEFAULT_LEVEL_ID;
  const n = Number(raw);
  return isLevelId(n) ? n : null;
}

/**
 * The leagues MLB files under the winter sportId, with the names readers know
 * them by (the API's own are the formal Spanish titles, without accents).
 */
const WINTER_LEAGUES: Record<number, string> = {
  119: 'Arizona Fall League',
  131: 'Dominican League (LIDOM)',
  132: 'Mexican Pacific League (LMP)',
  133: 'Puerto Rican League (LBPRC)',
  135: 'Venezuelan League (LVBP)',
  162: 'Caribbean Series',
  595: 'Australian Baseball League',
};

export function isWinterLeague(leagueId: number | undefined): boolean {
  return leagueId != null && leagueId in WINTER_LEAGUES;
}

/** Display name for a league on the schedule; falls back to the API's name. */
export function leagueLabel(league: { id?: number; name?: string } | undefined): string | null {
  if (!league) return null;
  return (league.id != null ? WINTER_LEAGUES[league.id] : undefined) ?? league.name ?? null;
}
