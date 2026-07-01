import type { RawBoxscoreTeam, RawLiveFeed, RawPlay, RawRunner } from '../mlbApi.js';
import type {
  BasesReached,
  Cell,
  HalfInning,
  InningLine,
  LineupSlot,
  PitchingLine,
  Scorecard,
  TeamScorecard,
} from '@mlb-scorecards/shared';
import { buildBatterCode, buildRunnerAdvancementCode } from './notation.js';
import { buildPredictive } from './predictive.js';

function toBaseFromLabel(label: string | null): '2B' | '3B' | 'HOME' | null {
  if (label === '2B') return '2B';
  if (label === '3B') return '3B';
  if (label === 'score' || label === 'home') return 'HOME';
  return null;
}

function basesReachedFromMovement(movement: RawRunner['movement']): BasesReached {
  if (movement.isOut) return 'out';
  if (movement.end === 'score') return 'HR';
  if (movement.end === '1B') return '1B';
  if (movement.end === '2B') return '2B';
  if (movement.end === '3B') return '3B';
  return 'out';
}

interface SlotInfo {
  slot: number;
  entrySeq: number;
  id: number;
  name: string;
  position: string;
}

function buildSlotMap(team: RawBoxscoreTeam): { byId: Map<number, number>; lineup: LineupSlot[] } {
  const entries: SlotInfo[] = [];
  for (const key of Object.keys(team.players)) {
    const p = team.players[key];
    if (!p.battingOrder) continue;
    const bo = parseInt(p.battingOrder, 10);
    const slot = Math.floor(bo / 100);
    const entrySeq = bo % 100;
    if (!slot) continue;
    entries.push({ slot, entrySeq, id: p.person.id, name: p.person.fullName, position: p.position?.abbreviation ?? '' });
  }
  const byId = new Map<number, number>();
  const bySlot = new Map<number, SlotInfo[]>();
  for (const e of entries) {
    byId.set(e.id, e.slot);
    if (!bySlot.has(e.slot)) bySlot.set(e.slot, []);
    bySlot.get(e.slot)!.push(e);
  }
  const lineup: LineupSlot[] = [...bySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, players]) => ({
      slot,
      players: players
        .sort((a, b) => a.entrySeq - b.entrySeq)
        .map((p) => ({ id: p.id, name: p.name, position: p.position, entrySeq: p.entrySeq })),
    }));
  return { byId, lineup };
}

function buildPitchingLines(team: RawBoxscoreTeam): PitchingLine[] {
  return team.pitchers.map((id) => {
    const player = team.players[`ID${id}`];
    const stats = player?.stats?.pitching;
    const decision: PitchingLine['decision'] = stats?.wins
      ? 'W'
      : stats?.losses
        ? 'L'
        : stats?.saves
          ? 'S'
          : null;
    return {
      id,
      name: player?.person.fullName ?? '',
      inningsPitched: stats?.inningsPitched ?? '0.0',
      hits: stats?.hits ?? 0,
      runs: stats?.runs ?? 0,
      earnedRuns: stats?.earnedRuns ?? 0,
      walks: stats?.baseOnBalls ?? 0,
      strikeouts: stats?.strikeOuts ?? 0,
      homeRuns: stats?.homeRuns ?? 0,
      pitches: stats?.numberOfPitches ?? 0,
      decision,
    };
  });
}

function buildTeamScorecard(
  team: RawBoxscoreTeam,
  plays: RawPlay[],
  halfInningFilter: HalfInning
): TeamScorecard {
  const { byId, lineup } = buildSlotMap(team);
  const cellsBySlot: Record<number, Cell[]> = {};
  for (const slot of lineup.map((l) => l.slot)) cellsBySlot[slot] = [];

  // Keyed by runner person id rather than by base: a single play's `runners[]` can list
  // the same physical runner more than once in chronological sub-events (e.g. a balk
  // advancing them 2B->3B, then later in the *same* play the batted ball scoring them
  // 3B->home), and two different runners can simultaneously swap through the same base
  // within one play. Identity-keyed lookup sidesteps both cases - no base-slot bookkeeping
  // race is possible since a runner's entry is found directly, not inferred from a base.
  let onBase = new Map<number, Cell>();
  let currentHalfKey = '';

  for (const play of plays) {
    if (play.about.halfInning !== halfInningFilter) continue;
    if (!play.about.isComplete) continue; // in-progress at-bat - no result yet
    const halfKey = `${play.about.inning}-${play.about.halfInning}`;
    if (halfKey !== currentHalfKey) {
      onBase = new Map();
      currentHalfKey = halfKey;
    }
    if (play.result.type !== 'atBat') {
      // Mid-at-bat action (mound visit, etc) with no result yet - no runner movement to apply.
      continue;
    }

    const batterId = play.matchup.batter.id;
    // MLB tags some standalone mid-at-bat baserunning events (e.g. a caught stealing that
    // happens before the batter's own plate appearance concludes) as result.type 'atBat' too,
    // but they carry no runner entry for the batter - there's no actual PA outcome to record.
    const batterRunner = play.runners.find((r) => r.details.runner.id === batterId);

    if (batterRunner) {
      const slot = byId.get(batterId);
      const { code, description } = buildBatterCode(play, batterRunner);
      const basesReached = basesReachedFromMovement(batterRunner.movement);
      const isOut = batterRunner.movement.isOut;

      const hitData = play.playEvents?.find((e) => e.hitData)?.hitData;
      const cell: Cell = {
        atBatIndex: play.about.atBatIndex,
        inning: play.about.inning,
        halfInning: play.about.halfInning,
        batterId,
        batterName: play.matchup.batter.fullName,
        count: { balls: play.count.balls, strikes: play.count.strikes },
        code,
        description,
        isOut,
        outNumber: isOut ? play.count.outs : null,
        rbi: play.result.rbi,
        basesReached,
        advancement: [],
        exitVelocity: hitData?.launchSpeed,
        distance: hitData?.totalDistance,
      };

      if (slot !== undefined) {
        if (!cellsBySlot[slot]) cellsBySlot[slot] = [];
        cellsBySlot[slot].push(cell);
      }

      if (!isOut && basesReached !== 'HR') {
        onBase.set(batterId, cell);
      }
    }

    // Every other runner in this play (pre-existing baserunners advancing, put out, or
    // scoring - including mid-at-bat events like steals/wild pitches/passed balls/balks).
    // Looked up by the runner's own id, so multiple sequential entries for the same
    // physical runner within one play all resolve to the same originating cell.
    for (const runner of play.runners) {
      if (runner.details.runner.id === batterId) continue;
      const owningCell = onBase.get(runner.details.runner.id);
      if (!owningCell) continue;

      const label = runner.movement.isOut ? runner.movement.outBase : runner.movement.end;
      const toBase = toBaseFromLabel(label);
      if (toBase) {
        const codeResult = buildRunnerAdvancementCode(runner, play.result.description);
        owningCell.advancement.push({
          toBase,
          code: codeResult?.code ?? '',
          description: codeResult?.description ?? play.result.description,
          isOut: runner.movement.isOut,
          atBatIndex: play.about.atBatIndex,
        });
      }

      if (runner.movement.isOut || toBase === 'HOME') {
        onBase.delete(runner.details.runner.id);
      }
    }
  }

  return {
    team: {
      id: team.team.id,
      name: team.team.name,
      abbreviation: team.team.abbreviation ?? team.team.name,
    },
    lineup,
    cellsBySlot,
    pitching: buildPitchingLines(team),
  };
}

export function transformLiveFeed(raw: RawLiveFeed): Scorecard {
  const plays = raw.liveData.plays.allPlays;
  const away = buildTeamScorecard(raw.liveData.boxscore.teams.away, plays, 'top');
  const home = buildTeamScorecard(raw.liveData.boxscore.teams.home, plays, 'bottom');

  const linescore = raw.liveData.linescore;
  const innings: InningLine[] = linescore.innings.map((inn) => ({
    num: inn.num,
    away: { runs: inn.away.runs ?? 0, hits: inn.away.hits ?? 0, lob: inn.away.leftOnBase ?? 0 },
    home: { runs: inn.home.runs ?? 0, hits: inn.home.hits ?? 0, lob: inn.home.leftOnBase ?? 0 },
  }));

  const isLive = raw.gameData.status.abstractGameState === 'Live';

  return {
    gamePk: raw.gamePk,
    status: {
      abstractGameState: raw.gameData.status.abstractGameState,
      detailedState: raw.gameData.status.detailedState,
    },
    inning: linescore.currentInning ?? innings.length,
    halfInning: (linescore.inningState ?? 'Top').toLowerCase() === 'bottom' ? 'bottom' : 'top',
    balls: isLive ? linescore.balls ?? 0 : 0,
    strikes: isLive ? linescore.strikes ?? 0 : 0,
    outs: isLive ? linescore.outs ?? 0 : 0,
    bases: {
      first: isLive ? Boolean(linescore.offense?.first) : false,
      second: isLive ? Boolean(linescore.offense?.second) : false,
      third: isLive ? Boolean(linescore.offense?.third) : false,
    },
    teams: { away, home },
    linescore: innings,
    totals: {
      away: { r: linescore.teams.away.runs, h: linescore.teams.away.hits, e: linescore.teams.away.errors },
      home: { r: linescore.teams.home.runs, h: linescore.teams.home.hits, e: linescore.teams.home.errors },
    },
    predictive: buildPredictive(raw),
    venue: raw.gameData.venue?.name ?? null,
    date: raw.gameData.datetime?.officialDate ?? null,
    updatedAt: new Date().toISOString(),
  };
}
