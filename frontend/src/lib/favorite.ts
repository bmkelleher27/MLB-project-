const KEY = 'favTeamId';

export function getFavoriteTeam(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setFavoriteTeam(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(id));
  } catch {
    // private mode etc - favorite just won't persist
  }
}
