/**
 * Pure matching of YouTube search results to one game. No I/O and no imports,
 * so it is tested directly against hand-written result sets.
 *
 * The search itself is fuzzy (YouTube ranks by relevance, not by fact), so
 * everything that decides "this video is this game" lives here and is strict:
 * both clubs must be named, any date written in the title must be the game's
 * date, and a doubleheader's "Game 2" never matches game 1.
 */

export interface VideoGame {
  /** Scheduled first pitch, ISO UTC. */
  gameDate: string;
  /** The game's calendar date as MLB records it ("YYYY-MM-DD"). */
  officialDate: string;
  /** e.g. 'R' regular season, 'S' spring training, 'W' World Series. */
  gameType: string;
  /** 'N' single game, 'Y'/'S' doubleheader. */
  doubleHeader: string;
  gameNumber: number;
  away: VideoTeam;
  home: VideoTeam;
}

export interface VideoTeam {
  /** Full name, "Texas Rangers". */
  name: string;
  /** Club name, "Rangers". Absent on some older schedule rows. */
  teamName?: string;
}

export interface SearchItem {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
}

export interface MatchedVideo extends SearchItem {
  kind: 'full' | 'highlights';
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * How titles name a club when it differs from MLB's own teamName. Keys are
 * normalised teamNames; MLB's highlight titles use "D-BACKS" and "A'S", and
 * fans and older uploads use the long forms.
 */
const ALIASES: Record<string, string[]> = {
  'd-backs': ['d-backs', 'dbacks', 'diamondbacks'],
  diamondbacks: ['d-backs', 'dbacks', 'diamondbacks'],
  athletics: ['athletics', "a's"],
  guardians: ['guardians'],
  indians: ['indians'],
};

/** Lowercase, strip accents, unify apostrophes and whitespace. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word containment, so "Reds" does not match "Red Sox". */
function containsWord(haystack: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9'])${escapeRegExp(word)}($|[^a-z0-9])`).test(haystack);
}

/** Every name a title might use for this club. */
export function teamTerms(team: VideoTeam): string[] {
  const terms = new Set<string>();
  const club = team.teamName ? normalize(team.teamName) : null;
  if (club) {
    terms.add(club);
    for (const alias of ALIASES[club] ?? []) terms.add(alias);
  }
  // "Toronto Blue Jays" → also accept the full name, which old uploads use.
  terms.add(normalize(team.name));
  if (!club) {
    // No teamName: fall back to the last word ("Yankees"), or last two when the
    // club name is two words ("Red Sox", "White Sox", "Blue Jays").
    const words = normalize(team.name).split(' ');
    const last = words[words.length - 1];
    terms.add(last === 'sox' || last === 'jays' ? words.slice(-2).join(' ') : last);
  }
  return [...terms];
}

function namesTeam(text: string, team: VideoTeam): boolean {
  return teamTerms(team).some((term) => containsWord(text, term));
}

/**
 * Explicit dates written in a title, as "YYYY-MM-DD" or "MM-DD" when the title
 * gives no year. Recognises "September 10", "Sept. 10", "Sep 10, 2026" and
 * "9/10/26" / "9/10/2026" / "9/10".
 */
export function datesInTitle(title: string): string[] {
  const t = normalize(title);
  const found: string[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  // Whole month names or their abbreviations only: a bare prefix would read
  // "Mariners 5" as March 5.
  const monthRe =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?\b/g;
  for (const m of t.matchAll(monthRe)) {
    const month = MONTHS.findIndex((name) => name.startsWith(m[1].slice(0, 3))) + 1;
    const day = Number(m[2]);
    if (month < 1 || day < 1 || day > 31) continue;
    found.push(m[3] ? `${m[3]}-${pad(month)}-${pad(day)}` : `${pad(month)}-${pad(day)}`);
  }

  const numericRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/g;
  for (const m of t.matchAll(numericRe)) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : null;
    found.push(year ? `${year}-${pad(month)}-${pad(day)}` : `${pad(month)}-${pad(day)}`);
  }
  return found;
}

/** True when no date is written, or every written date is this game's. */
function datesAgree(title: string, officialDate: string): boolean {
  const monthDay = officialDate.slice(5);
  return datesInTitle(title).every((d) => (d.length === 5 ? d === monthDay : d === officialDate));
}

/** Rejects "Game 2" for game 1 of a doubleheader (series titles are left alone). */
function doubleheaderAgrees(title: string, game: VideoGame): boolean {
  if (game.doubleHeader === 'N') return true;
  const m = normalize(title).match(/\bgame ([12])\b/);
  return !m || Number(m[1]) === game.gameNumber;
}

export function classify(title: string): 'full' | 'highlights' | null {
  const t = normalize(title);
  if (/\bhighlights?\b/.test(t) || /\bcondensed\b/.test(t)) return 'highlights';
  if (/\bfull game\b/.test(t) || /\bfull broadcast\b/.test(t)) return 'full';
  return null;
}

const HOUR = 3_600_000;

/** MLB posts full-game highlights within hours; allow a few days for stragglers. */
export const HIGHLIGHT_WINDOW = { beforeMs: 6 * HOUR, afterMs: 5 * 24 * HOUR };

export function inHighlightWindow(publishedAt: string, gameDate: string): boolean {
  const published = Date.parse(publishedAt);
  const start = Date.parse(gameDate);
  if (!Number.isFinite(published) || !Number.isFinite(start)) return false;
  return published >= start - HIGHLIGHT_WINDOW.beforeMs && published <= start + HIGHLIGHT_WINDOW.afterMs;
}

/**
 * Decides whether one search result is this game, and what kind of video it is.
 *
 * Highlights must also have been published shortly after the game: MLB's
 * highlight titles carry month and day but not the year, so the publish date is
 * what tells this season's Rangers–Mariners on September 10 from last year's.
 * Full games are often uploaded years later (MLB Vault), so for those the year
 * must appear in the title or description instead.
 */
export function matchVideo(item: SearchItem, game: VideoGame): MatchedVideo | null {
  const kind = classify(item.title);
  if (!kind) return null;

  const title = normalize(item.title);
  const text = `${title} ${normalize(item.description)}`;
  // Teams must be in the title for highlights; full-game uploads sometimes put
  // the matchup only in the description ("Nolan Ryan's 6th No-Hitter").
  const teamText = kind === 'highlights' ? title : text;
  if (!namesTeam(teamText, game.away) || !namesTeam(teamText, game.home)) return null;

  if (!datesAgree(item.title, game.officialDate)) return null;
  if (!doubleheaderAgrees(item.title, game)) return null;
  if (game.gameType !== 'S' && /\bspring (training|breakout)\b/.test(title)) return null;

  if (kind === 'highlights') {
    if (!inHighlightWindow(item.publishedAt, game.gameDate)) return null;
  } else {
    const year = game.officialDate.slice(0, 4);
    const yearWritten = new RegExp(`\\b${year}\\b`).test(text);
    if (!yearWritten && !inHighlightWindow(item.publishedAt, game.gameDate)) return null;
  }
  return { ...item, kind };
}

/**
 * The best full game and the best highlights among the results, full first.
 * Results arrive in YouTube's relevance order, so the first match of each kind
 * wins; an explicit date in the title breaks a tie in its favour.
 */
export function pickVideos(items: SearchItem[], game: VideoGame): MatchedVideo[] {
  const matched = items
    .map((item) => matchVideo(item, game))
    .filter((m): m is MatchedVideo => m !== null);

  const best = (kind: 'full' | 'highlights') => {
    const ofKind = matched.filter((m) => m.kind === kind);
    return ofKind.find((m) => datesInTitle(m.title).length > 0) ?? ofKind[0] ?? null;
  };

  const seen = new Set<string>();
  return [best('full'), best('highlights')].filter((m): m is MatchedVideo => {
    if (!m || seen.has(m.videoId)) return false;
    seen.add(m.videoId);
    return true;
  });
}

/** MLB's own channel search, offered when nothing matched or no key is set. */
export function channelSearchUrl(game: VideoGame): string {
  const [y, m, d] = game.officialDate.split('-').map(Number);
  const month = MONTHS[m - 1];
  const label = (t: VideoTeam) => t.teamName ?? t.name;
  const query = `${label(game.away)} vs ${label(game.home)} ${month[0].toUpperCase()}${month.slice(1)} ${d} ${y}`;
  return `https://www.youtube.com/@MLB/search?query=${encodeURIComponent(query)}`;
}
