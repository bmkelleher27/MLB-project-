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

