import { Router } from 'express';
import type { AtBatDetailResponse, GameAtBatsResponse, PitchDetail } from '@mlb-scorecards/shared';
import { getLiveFeed, type RawPlay } from '../mlbApi.js';
import { buildBatterCode } from '../scorecard/notation.js';
import { computeStuff } from '../scorecard/stuff.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const router = Router();

router.get('/:gamePk/scorecard', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    res.json(transformLiveFeed(raw));
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

function buildPitches(play: RawPlay): PitchDetail[] {
  const pitches: PitchDetail[] = [];
  let seq = 0;
  for (const e of play.playEvents ?? []) {
    if (!e.isPitch) continue;
    seq += 1;
    const pd = e.pitchData;
    const breaks = pd?.breaks;
    const type = e.details?.type?.code ?? null;
    const velocity = pd?.startSpeed ?? null;
    const ivb = breaks?.breakVerticalInduced ?? null;
    const ihb = breaks?.breakHorizontal ?? null;
    pitches.push({
      number: e.pitchNumber ?? seq,
      type,
      typeDesc: e.details?.type?.description ?? null,
      velocity,
      spinRate: breaks?.spinRate ?? null,
      ivb,
      ihb,
      outcome: e.details?.description ?? e.details?.call?.code ?? '',
      isBall: Boolean(e.details?.isBall),
      isStrike: Boolean(e.details?.isStrike),
      inPlay: Boolean(e.details?.isInPlay),
      balls: e.count?.balls ?? 0,
      strikes: e.count?.strikes ?? 0,
      px: pd?.coordinates?.pX ?? null,
      pz: pd?.coordinates?.pZ ?? null,
      szTop: pd?.strikeZoneTop ?? null,
      szBottom: pd?.strikeZoneBottom ?? null,
      stuff: computeStuff(type, velocity, ivb, ihb, pd?.extension ?? null),
    });
  }
  return pitches;
}

function buildAtBat(play: RawPlay, gamePk: number): AtBatDetailResponse {
  const batterId = play.matchup.batter.id;
  const batterRunner = play.runners.find((r) => r.details.runner.id === batterId);
  const { code } = buildBatterCode(play, batterRunner);
  const hitData = play.playEvents?.find((e) => e.hitData)?.hitData;

  return {
    gamePk,
    atBatIndex: play.about.atBatIndex,
    inning: play.about.inning,
    halfInning: play.about.halfInning,
    batter: play.matchup.batter.fullName,
    pitcher: play.matchup.pitcher.fullName,
    code,
    result: play.result.description,
    rbi: play.result.rbi,
    exitVelocity: hitData?.launchSpeed ?? null,
    launchAngle: hitData?.launchAngle ?? null,
    distance: hitData?.totalDistance ?? null,
    pitches: buildPitches(play),
  };
}

router.get('/:gamePk/atbats', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  if (!Number.isInteger(gamePk)) {
    res.status(400).json({ error: 'invalid gamePk' });
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    // Every play that had at least one pitch is a plate appearance worth showing;
    // pure baserunning plays (pickoffs, steals between batters) carry no pitches.
    const atBats = raw.liveData.plays.allPlays
      .filter((p) => p.playEvents?.some((e) => e.isPitch))
      .sort((a, b) => a.about.atBatIndex - b.about.atBatIndex)
      .map((p) => buildAtBat(p, gamePk));
    const body: GameAtBatsResponse = { gamePk, atBats };
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
