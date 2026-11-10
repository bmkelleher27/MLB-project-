import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RawLiveFeed } from '../src/mlbApi.js';
import { scorecardSignature } from '../src/scorecard/gameStore.js';
import { transformLiveFeed } from '../src/scorecard/transform.js';

const feed = JSON.parse(
  readFileSync(new URL('./fixtures/game-2024-final.json', import.meta.url), 'utf8')
) as RawLiveFeed;

describe('scorecardSignature', () => {
  it('is identical for two transforms of an unchanged feed', () => {
    // The transform stamps `updatedAt` each time, so the raw payloads differ
    // even though the game has not moved — which is what made every poll look
    // like a change.
    const first = transformLiveFeed(feed);
    const second = { ...transformLiveFeed(feed), updatedAt: '2099-01-01T00:00:00.000Z' };
    expect(first.updatedAt).not.toBe(second.updatedAt);
    expect(scorecardSignature(first)).toBe(scorecardSignature(second));
  });

  it('changes when the game state changes', () => {
    const before = transformLiveFeed(feed);
    const after = { ...before, outs: before.outs + 1 };
    expect(scorecardSignature(after)).not.toBe(scorecardSignature(before));
  });

  it('does not modify the scorecard it is given', () => {
    const scorecard = transformLiveFeed(feed);
    const stamp = scorecard.updatedAt;
    scorecardSignature(scorecard);
    expect(scorecard.updatedAt).toBe(stamp);
  });
});
