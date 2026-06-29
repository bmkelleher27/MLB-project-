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
  scored: boolean;
}

export interface LineupSlotPlayer {
  id: number;
  name: string;
  entrySeq: number;
}

export interface LineupSlot {
  slot: number;
  players: LineupSlotPlayer[];
}

export interface TeamScorecard {
  team: { id: number; name: string; abbreviation: string };
  lineup: LineupSlot[];
  cellsBySlot: Record<number, Cell[]>;
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
  venue: string | null;
  updatedAt: string;
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  status: GameStatus;
  inning: number | null;
  inningState: string | null;
  away: { id: number; name: string; abbreviation: string; score: number | null };
  home: { id: number; name: string; abbreviation: string; score: number | null };
  venue: string | null;
}

export interface ScheduleResponse {
  date: string;
  games: ScheduleGame[];
}
