import { describe, expect, it } from 'vitest';
import { DEFAULT_LEVEL_ID, LEVELS, getLevel, isLevelId } from '@mlb-scorecards/shared';
import { parseLevel } from '../src/levels.js';

describe('parseLevel', () => {
  it('defaults to the majors when absent or empty', () => {
    expect(parseLevel(undefined)).toBe(DEFAULT_LEVEL_ID);
    expect(parseLevel(null)).toBe(DEFAULT_LEVEL_ID);
    expect(parseLevel('')).toBe(DEFAULT_LEVEL_ID);
  });

  it('accepts every supported level, as string or number', () => {
    for (const level of LEVELS) {
      expect(parseLevel(String(level.id))).toBe(level.id);
      expect(parseLevel(level.id)).toBe(level.id);
    }
  });

  it('rejects sports outside the supported list rather than passing them upstream', () => {
    // 22 is college, 31 is NPB — real MLB sportIds this app does not cover.
    expect(parseLevel('22')).toBeNull();
    expect(parseLevel('31')).toBeNull();
    expect(parseLevel('999')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(parseLevel('AAA')).toBeNull();
    expect(parseLevel('1; DROP TABLE')).toBeNull();
  });
});

describe('level metadata', () => {
  it('runs from the majors down', () => {
    expect(LEVELS[0].abbreviation).toBe('MLB');
    expect(LEVELS.at(-1)?.abbreviation).toBe('ROK');
  });

  it('marks pitch tracking only where it actually exists', () => {
    // Hawk-Eye is throughout MLB and Triple-A; below that it is partial at best.
    expect(getLevel(1)?.pitchTracking).toBe('full');
    expect(getLevel(11)?.pitchTracking).toBe('full');
    expect(getLevel(12)?.pitchTracking).toBe('partial');
    expect(getLevel(16)?.pitchTracking).toBe('none');
  });

  it('guards the level id type', () => {
    expect(isLevelId(11)).toBe(true);
    expect(isLevelId(22)).toBe(false);
  });

  it('returns undefined for an unknown level', () => {
    expect(getLevel(999)).toBeUndefined();
  });
});
