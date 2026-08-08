import { DEFAULT_LEVEL_ID, isLevelId, type LevelId } from '@mlb-scorecards/shared';

const KEY = 'level';

/** The level the reader last browsed, so the choice survives a reload. */
export function storedLevel(): LevelId {
  try {
    const raw = Number(localStorage.getItem(KEY));
    return isLevelId(raw) ? raw : DEFAULT_LEVEL_ID;
  } catch {
    return DEFAULT_LEVEL_ID;
  }
}

export function setStoredLevel(level: LevelId): void {
  try {
    localStorage.setItem(KEY, String(level));
  } catch {
    // private mode etc — the choice just won't persist
  }
}

/** Parses a level from a URL param, falling back to the stored preference. */
export function levelFromParam(raw: string | null): LevelId {
  const n = Number(raw);
  return isLevelId(n) ? n : storedLevel();
}
