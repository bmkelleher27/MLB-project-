const KEY = 'favTeamIds';
const LEGACY_KEY = 'favTeamId';

/** Favorite team ids, in the order they were starred. */
export function getFavoriteTeams(): number[] {
  try {
    const v = localStorage.getItem(KEY);
    if (v !== null) {
      const arr = JSON.parse(v) as unknown;
      if (Array.isArray(arr)) return arr.filter((n): n is number => Number.isFinite(n));
    }
    // Migrate the old single-favorite key.
    const legacy = localStorage.getItem(LEGACY_KEY);
    const n = legacy === null ? NaN : Number(legacy);
    if (Number.isFinite(n)) {
      const list = [n];
      localStorage.setItem(KEY, JSON.stringify(list));
      localStorage.removeItem(LEGACY_KEY);
      return list;
    }
    return [];
  } catch {
    return [];
  }
}

export function toggleFavoriteTeam(id: number): number[] {
  const current = getFavoriteTeams();
  const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode etc - favorites just won't persist
  }
  return next;
}

/** The first-starred favorite, used where only one team makes sense (season default). */
export function getFavoriteTeam(): number | null {
  return getFavoriteTeams()[0] ?? null;
}
