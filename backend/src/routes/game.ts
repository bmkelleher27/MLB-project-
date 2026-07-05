import { Router } from 'express';
import type { AtBatDetailResponse, PitchDetail } from '@mlb-scorecards/shared';
import { getLiveFeed, type RawPlay } from '../mlbApi.js';
import { buildBatterCode } from '../scorecard/notation.js';
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
    pitches.push({
      number: e.pitchNumber ?? seq,
      type: e.details?.type?.code ?? null,
      typeDesc: e.details?.type?.description ?? null,
      velocity: pd?.startSpeed ?? null,
      spinRate: breaks?.spinRate ?? null,
      ivb: breaks?.breakVerticalInduced ?? null,
      ihb: breaks?.breakHorizontal ?? null,
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
    });
  }
  return pitches;
}

router.get('/:gamePk/atbat/:atBatIndex', async (req, res) => {
  const gamePk = Number(req.params.gamePk);
  const atBatIndex = Number(req.params.atBatIndex);
  if (!Number.isInteger(gamePk) || !Number.isInteger(atBatIndex)) {
    res.status(400).json({ error: 'invalid gamePk or atBatIndex' });
    return;
  }

  try {
    const raw = await getLiveFeed(gamePk);
    const play = raw.liveData.plays.allPlays.find((p) => p.about.atBatIndex === atBatIndex);
    if (!play) {
      res.status(404).json({ error: 'at-bat not found' });
      return;
    }

    const batterId = play.matchup.batter.id;
    const batterRunner = play.runners.find((r) => r.details.runner.id === batterId);
    const { code } = buildBatterCode(play, batterRunner);
    const hitData = play.playEvents?.find((e) => e.hitData)?.hitData;

    const body: AtBatDetailResponse = {
      gamePk,
      atBatIndex,
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
    res.json(body);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
