import type { DailyStarsResponse, ScheduleGame } from '@mlb-scorecards/shared';

export interface GameBadge {
  key: string;
  label: string;
  className: string;
  /** Badges that give away a final's outcome are hidden in spoiler-safe mode. */
  spoils: boolean;
}

function margin(game: ScheduleGame): number {
  return Math.abs((game.away.score ?? 0) - (game.home.score ?? 0));
}

function inningsPlayed(game: ScheduleGame): number {
  return game.linescore?.length ?? 0;
}

/** True walk-off: home won, scored in their final frame, and needed those runs. */
function isWalkOff(game: ScheduleGame): boolean {
  const away = game.away.score ?? 0;
  const home = game.home.score ?? 0;
  const last = game.linescore?.at(-1)?.home ?? 0;
  return home > away && last > 0 && home - last <= away;
}

export function gameBadges(game: ScheduleGame): GameBadge[] {
  const badges: GameBadge[] = [];
  const state = game.status.abstractGameState;

  if (state === 'Live') {
    const inn = game.inning ?? 0;
    if (game.hits && inn >= 6 && (game.hits.away === 0 || game.hits.home === 0)) {
      badges.push({ key: 'nono', label: 'NO-HITTER', className: 'badge-nono', spoils: false });
    }
    if (inn >= 10) {
      badges.push({ key: 'extras', label: 'EXTRAS', className: 'badge-extras', spoils: false });
    } else if (inn >= 7 && margin(game) <= 1) {
      badges.push({ key: 'closelate', label: 'CLOSE · LATE', className: 'badge-close', spoils: false });
    }
  }

  if (state === 'Final') {
    if (isWalkOff(game)) {
      badges.push({ key: 'walkoff', label: 'WALK-OFF', className: 'badge-walkoff', spoils: true });
    }
    const innings = inningsPlayed(game);
    if (innings > 9) {
      badges.push({ key: 'finalextras', label: `F/${innings}`, className: 'badge-extras', spoils: true });
    }
    if (game.hits && (game.hits.away === 0 || game.hits.home === 0)) {
      badges.push({ key: 'nono', label: 'NO-HITTER', className: 'badge-nono', spoils: true });
    }
  }

  return badges;
}

/**
 * Watchability of a live game: close-and-late floats up, blowouts sink.
 * Only meaningful for Live games; higher is more watchable.
 */
export function drama(game: ScheduleGame): number {
  if (game.status.abstractGameState !== 'Live') return -1;
  const inn = game.inning ?? 1;
  const m = margin(game);
  const runners = game.situation
    ? Number(game.situation.onFirst) + Number(game.situation.onSecond) + Number(game.situation.onThird)
    : 0;
  let score = inn * 3 - Math.min(m, 10) * 8 + runners * 2;
  if (inn >= 7 && m <= 1) score += 40;
  if (inn >= 10) score += 25;
  if (game.hits && inn >= 6 && (game.hits.away === 0 || game.hits.home === 0)) score += 60;
  return score;
}

/** One-line "why watch this" for the hero card. */
export function dramaReason(game: ScheduleGame): string | null {
  if (game.status.abstractGameState !== 'Live') return null;
  const inn = game.inning ?? 0;
  const m = margin(game);
  const half = (game.inningState ?? '').toLowerCase();
  const where = inn ? `${half} ${inn}` : 'in progress';
  if (game.hits && inn >= 6 && (game.hits.away === 0 || game.hits.home === 0)) {
    const side = game.hits.away === 0 ? game.home.abbreviation : game.away.abbreviation;
    return `${side} has a no-hitter going — ${where}`;
  }
  if (inn >= 10) return `Free baseball — ${where}`;
  if (m === 0 && inn >= 7) return `Tied in the ${where}`;
  if (m <= 1 && inn >= 7) return `One-run game, ${where}`;
  if (m <= 2 && inn >= 5) return `Close one, ${where}`;
  return null;
}

// ── Spoiler-safe mode ───────────────────────────────────────────────────

const SPOILER_KEY = 'spoilerSafe';

export function getSpoilerSafe(): boolean {
  try {
    return localStorage.getItem(SPOILER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSpoilerSafe(on: boolean): void {
  try {
    if (on) localStorage.setItem(SPOILER_KEY, '1');
    else localStorage.removeItem(SPOILER_KEY);
  } catch {
    // ignore
  }
}

/** Whether either team in this game is among the given favorite team ids. */
export function involvesFavorite(game: ScheduleGame, favorites: number[]): boolean {
  return favorites.includes(game.away.id) || favorites.includes(game.home.id);
}

export type HeroPick =
  | { kind: 'live'; game: ScheduleGame }
  | { kind: 'upcoming'; game: ScheduleGame }
  | { kind: 'replay'; pick: NonNullable<DailyStarsResponse['replayPick']> };

/** The single game most worth surfacing right now. */
export function pickHero(
  games: ScheduleGame[],
  favorites: number[],
  stars: DailyStarsResponse | null
): HeroPick | null {
  const live = games.filter((g) => g.status.abstractGameState === 'Live');
  if (live.length > 0) {
    const fav = live.find((g) => involvesFavorite(g, favorites));
    const game = fav ?? [...live].sort((a, b) => drama(b) - drama(a))[0];
    return { kind: 'live', game };
  }
  const upcoming = games
    .filter((g) => g.status.abstractGameState !== 'Live' && g.status.abstractGameState !== 'Final')
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  if (upcoming.length > 0) {
    return { kind: 'upcoming', game: upcoming.find((g) => involvesFavorite(g, favorites)) ?? upcoming[0] };
  }
  if (stars?.replayPick) return { kind: 'replay', pick: stars.replayPick };
  return null;
}

