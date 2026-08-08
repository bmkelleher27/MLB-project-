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
