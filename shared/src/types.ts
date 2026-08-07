export type HalfInning = 'top' | 'bottom';

export interface Count {
  balls: number;
  strikes: number;
}

export interface Advancement {
  toBase: '2B' | '3B' | 'HOME';
  code: string;
  description: string;
  isOut: boolean;
  atBatIndex: number;
}

export type BasesReached = 'out' | '1B' | '2B' | '3B' | 'HR';

export interface Cell {
  atBatIndex: number;
  inning: number;
  halfInning: HalfInning;
  batterId: number;
  batterName: string;
  count: Count;
  code: string;
  description: string;
  isOut: boolean;
  outNumber: number | null;
  rbi: number;
  basesReached: BasesReached;
  advancement: Advancement[];
  exitVelocity?: number;
  distance?: number;
}

export interface LineupSlotPlayer {
  id: number;
  name: string;
  position: string;
  entrySeq: number;
}

export interface LineupSlot {
  slot: number;
  players: LineupSlotPlayer[];
}

export interface PitchingLine {
  id: number;
  name: string;
  inningsPitched: string;
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  pitches: number;
  decision: 'W' | 'L' | 'S' | null;
  /** Average estimated Stuff+ over the pitcher's tracked pitches (100 = league average); null when ungradeable. */
  stuff: number | null;
}

export interface TeamScorecard {
  team: { id: number; name: string; abbreviation: string };
  lineup: LineupSlot[];
  cellsBySlot: Record<number, Cell[]>;
  pitching: PitchingLine[];
}

export interface InningLineHalf {
  runs: number;
  hits: number;
  lob: number;
}

export interface InningLine {
  num: number;
  away: InningLineHalf;
  home: InningLineHalf;
}

export interface TeamTotals {
  r: number;
  h: number;
  e: number;
}

export interface BaseState {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface GameStatus {
  abstractGameState: string; // Preview | Live | Final
  detailedState: string; // Scheduled, In Progress, Final, Postponed, ...
}

export interface PredictiveBatter {
  id: number;
  name: string;
  pa: number;
  strikeouts: number;
  walks: number;
  battedBalls: number;
  barrels: number;
  hardHit: number;
  /** Mean exit velocity of tracked batted balls; null when Statcast data is unavailable (pre-2015). */
  avgEV: number | null;
  /** Damage Index: expected production per PA from contact quality + discipline, 100 = league average. */
  dmg: number;
}

export interface PredictivePitcher {
  id: number;
  name: string;
  pitches: number;
  calledStrikes: number;
  whiffs: number;
  /** Called strikes + whiffs per pitch (league average ≈ 0.29). */
  csw: number;
  battedBallsAllowed: number;
  hardHitAllowed: number;
  avgEVAllowed: number | null;
  /** Dominance Index: CSW rate + contact suppression, 100 = league average. */
  dom: number;
}

export interface TeamPredictive {
  batters: PredictiveBatter[];
  pitchers: PredictivePitcher[];
}

export interface Scorecard {
  gamePk: number;
  status: GameStatus;
  inning: number;
  halfInning: HalfInning;
  balls: number;
  strikes: number;
  outs: number;
  bases: BaseState;
  teams: {
    away: TeamScorecard;
    home: TeamScorecard;
  };
  linescore: InningLine[];
  totals: {
    away: TeamTotals;
    home: TeamTotals;
  };
  predictive: {
    away: TeamPredictive;
    home: TeamPredictive;
  };
  venue: string | null;
  date: string | null;
  updatedAt: string;
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  status: GameStatus;
  inning: number | null;
  inningState: string | null;
  away: { id: number; name: string; abbreviation: string; score: number | null; probablePitcher: string | null };
  home: { id: number; name: string; abbreviation: string; score: number | null; probablePitcher: string | null };
  venue: string | null;
  linescore: Array<{ num: number; away: number | null; home: number | null }> | null;
  /** Team hit totals (for no-hitter detection); null pre-game. */
  hits: { away: number; home: number } | null;
  /** Live base-out state and current matchup; null unless the game is Live. */
  situation: {
    outs: number;
    onFirst: boolean;
    onSecond: boolean;
    onThird: boolean;
    batter: string | null;
    pitcher: string | null;
  } | null;
}

export interface ScheduleResponse {
  date: string;
  games: ScheduleGame[];
}

export interface TeamInfo {
  id: number;
  name: string;
  abbreviation: string;
}

// ── Daily stars (yesterday's best performances) ─────────────────────────

export interface DailyStarLine {
  playerId: number;
  name: string;
  teamAbbr: string;
  gamePk: number;
  /** DMG for batters, DOM for pitchers. */
  index: number;
  /** Human box-score line, e.g. "3-for-4, 2 HR, 4 RBI" or "7.0 IP, 10 K, 1 ER". */
  line: string;
}

export interface DailyStarsResponse {
  date: string;
  batters: DailyStarLine[];
  pitchers: DailyStarLine[];
  /** A finished game worth replaying (walk-off, extras, or the tightest finish). */
  replayPick: {
    gamePk: number;
    awayAbbr: string;
    homeAbbr: string;
    awayScore: number;
    homeScore: number;
    reason: string;
  } | null;
}

export interface SeasonGame {
  gamePk: number;
  gameDate: string;
  /** R regular season, F wild card, D division series, L LCS, W World Series */
  gameType: string;
  status: GameStatus;
  /** Whether the selected team was the home side. */
  isHome: boolean;
  opponent: TeamInfo;
  teamScore: number | null;
  opponentScore: number | null;
  /** null until the game is Final. */
  won: boolean | null;
  venue: string | null;
}

export interface SeasonResponse {
  teamId: number;
  season: number;
  games: SeasonGame[];
}

export interface BattingLogEntry {
  date: string;
  gamePk: number | null;
  opponent: string;
  isHome: boolean;
  atBats: number;
  hits: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  avg: string;
}

export interface PitchingLogEntry {
  date: string;
  gamePk: number | null;
  opponent: string;
  isHome: boolean;
  inningsPitched: string;
  hits: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
}

export interface SeasonBattingTotals {
  games: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  homeRuns: number;
  rbi: number;
  hits: number;
  runs: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
}

export interface SeasonPitchingTotals {
  games: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  saves: number;
  era: string;
  whip: string;
  inningsPitched: string;
  strikeouts: number;
  walks: number;
}

export interface PlayerLogResponse {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
  season: number;
  seasonBatting: SeasonBattingTotals | null;
  seasonPitching: SeasonPitchingTotals | null;
  batting: BattingLogEntry[];
  pitching: PitchingLogEntry[];
}

export interface SeasonPredictiveResponse {
  teamId: number;
  season: number;
  gamesProcessed: number;
  batters: PredictiveBatter[];
  pitchers: PredictivePitcher[];
}

export interface PitchDetail {
  /** 1-based pitch number within the plate appearance. */
  number: number;
  type: string | null; // pitch-type code, e.g. "FF"
  typeDesc: string | null; // "Four-Seam Fastball"
  velocity: number | null; // release speed, mph
  spinRate: number | null; // rpm
  ivb: number | null; // induced vertical break, inches
  ihb: number | null; // horizontal break, inches
  outcome: string; // "Foul", "Called Strike", "Ball", "In play, out(s)", ...
  isBall: boolean;
  isStrike: boolean;
  inPlay: boolean;
  /** Ball-strike count after this pitch. */
  balls: number;
  strikes: number;
  // Location as the ball crosses the front of the plate, catcher's view (feet).
  px: number | null; // horizontal, 0 = center of plate, positive = catcher's right
  pz: number | null; // vertical, feet above the ground
  szTop: number | null; // batter's strike-zone top, feet
  szBottom: number | null; // batter's strike-zone bottom, feet
  /** Estimated Stuff+ (100 = league average); null when not gradeable. */
  stuff: number | null;
}

export interface AtBatDetailResponse {
  gamePk: number;
  atBatIndex: number;
  inning: number;
  halfInning: HalfInning;
  batter: string;
  pitcher: string;
  code: string; // scorekeeping shorthand, e.g. "K", "6-3", "HR"
  result: string; // MLB plain-language play description
  rbi: number;
  exitVelocity: number | null;
  launchAngle: number | null;
  distance: number | null;
  /** Gameday spray coordinates (0-250 grid, home plate near x=125, y=200). */
  hitX: number | null;
  hitY: number | null;
  trajectory: string | null; // ground_ball | line_drive | fly_ball | popup
  pitches: PitchDetail[];
}

export interface GameAtBatsResponse {
  gamePk: number;
  status: { abstractGameState: string; detailedState: string };
  teams: {
    away: { name: string; abbreviation: string };
    home: { name: string; abbreviation: string };
  };
  /** Every plate appearance with pitch tracking, in game order. */
  atBats: AtBatDetailResponse[];
}

// ── Pre-game preview ────────────────────────────────────────────────────

export interface PitcherStartLine {
  gamePk: number | null;
  date: string; // YYYY-MM-DD
  opponentAbbr: string;
  isHome: boolean;
  ip: string; // e.g. "6.2"
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  pitches: number | null;
}

export interface BatterVsPitcherLine {
  batterId: number;
  name: string;
  ab: number;
  hits: number;
  doubles: number;
  homeRuns: number;
  walks: number;
  strikeouts: number;
  avg: string; // e.g. ".333"
  ops: string;
}

export interface ProbablePitcherPreview {
  id: number;
  name: string;
  /** 'L' | 'R' when known. */
  hand: string | null;
  /** Most recent first, up to 5 (topped up from the prior season early in the year). */
  starts: PitcherStartLine[];
  /** Aggregates over `starts`; null when there are none. */
  span: { ip: string; era: number; whip: number; kPer9: number } | null;
  /** Career history of the opposing team's hitters against this pitcher, most AB first. */
  vsLineup: BatterVsPitcherLine[];
}

export interface GamePreviewSide {
  team: { id: number; name: string; abbreviation: string };
  probable: ProbablePitcherPreview | null;
}

export interface GamePreviewResponse {
  gamePk: number;
  status: { abstractGameState: string; detailedState: string };
  away: GamePreviewSide;
  home: GamePreviewSide;
}


// ── Player search & aggregate profile ───────────────────────────────────

export interface PlayerSearchResult {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
  /** Batting side / throwing hand codes ('L' | 'R' | 'S'), when known. */
  bats: string | null;
  throws: string | null;
  active: boolean;
}

export interface PlayerSearchResponse {
  query: string;
  players: PlayerSearchResult[];
}

/**
 * What happened against one pitch type. Rate stats are null when the sample is
 * too small to mean anything; the raw counts are always present.
 */
export interface PitchTypePerformance {
  plateAppearances: number;
  atBats: number;
  hits: number;
  totalBases: number;
  strikeouts: number;
  swings: number;
  whiffs: number;
  /** Batting average against this pitch type (null below the sample floor). */
  avg: number | null;
  slg: number | null;
  strikeoutRate: number | null;
  /** Whiffs per swing — measured over every pitch, not just PA-ending ones. */
  whiffRate: number | null;
  lowSample: boolean;
}

/** One pitch type in a player's arsenal — thrown (pitcher) or faced (batter). */
export interface PitchTypeUsage {
  /** MLB pitch code, e.g. 'FF', 'SL'. */
  code: string;
  /** Human name, e.g. 'Four-seam FB'. */
  name: string;
  count: number;
  /** Share of all pitches, 0..1. */
  share: number;
  avgSpeed: number | null;
  /** Results against this pitch type; null when the per-pitch logs are unavailable. */
  performance: PitchTypePerformance | null;
}

/** A single cell of the 13-zone Gameday grid (9 in-zone + 4 outside quadrants). */
export interface ZoneCell {
  /** '01'-'09' inside the strike zone, '11'-'14' outside quadrants. */
  zone: string;
  value: number | null;
  /** The API's own formatted value, e.g. '.333' or '91.99'. */
  display: string;
}

export interface ZoneMetric {
  /** API name, e.g. 'onBasePlusSlugging'. */
  name: string;
  /** Short label for the UI, e.g. 'OPS'. */
  label: string;
  /** Longer explanation for a tooltip. */
  description: string;
  /**
   * 'performance' encodes polarity around the player's own average (diverging);
   * 'volume' encodes plain magnitude such as pitch counts (sequential).
   */
  kind: 'performance' | 'volume';
  cells: ZoneCell[];
  /** Midpoint for diverging scales / total for volume; null when unavailable. */
  reference: number | null;
}

/** Platoon or situational split line. */
export interface SplitLine {
  code: string;
  label: string;
  plateAppearances: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  strikeouts: number;
  walks: number;
  homeRuns: number;
}

/** One month of a season, for trend charts. */
export interface TrendPoint {
  month: number;
  label: string;
  games: number;
  /** Primary rate stat: OPS for hitters, ERA for pitchers. */
  primary: number | null;
  /** Secondary rate: AVG allowed/hit. */
  secondary: number | null;
  strikeoutRate: number | null;
  walkRate: number | null;
}

export interface PlayerProfileSide {
  arsenal: PitchTypeUsage[];
  zones: ZoneMetric[];
  splits: SplitLine[];
  trend: TrendPoint[];
}

export interface PlayerProfileResponse {
  id: number;
  name: string;
  position: string | null;
  team: string | null;
  bats: string | null;
  throws: string | null;
  season: number;
  /** How this player was pitched (present when they batted this season). */
  batting: PlayerProfileSide | null;
  /** How this player pitched (present when they pitched this season). */
  pitching: PlayerProfileSide | null;
}
