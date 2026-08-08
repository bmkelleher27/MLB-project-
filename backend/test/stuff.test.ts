import { describe, expect, it } from 'vitest';
import { computeStuff } from '../src/scorecard/stuff.js';

describe('computeStuff', () => {
  it('returns null for ungradeable or missing inputs', () => {
    expect(computeStuff(null, 95, 18, -10, 6.5)).toBeNull();
    expect(computeStuff('KN', 78, 5, 8, 6.0)).toBeNull(); // knuckleball: no reference
    expect(computeStuff('EP', 55, 0, 0, 6.0)).toBeNull(); // eephus
    expect(computeStuff('FF', null, 18, -10, 6.5)).toBeNull(); // no velocity
    expect(computeStuff('FF', 95, null, -10, 6.5)).toBeNull(); // no movement (pre-2015)
    expect(computeStuff('FF', 95, 18, null, 6.5)).toBeNull();
  });

  it('grades a league-average four-seam near 100', () => {
    const s = computeStuff('FF', 93.5, 15.5, 0, 6.4);
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(95);
    expect(s!).toBeLessThanOrEqual(105);
  });

  it('grades an elite four-seam well above average', () => {
    // high velo + high ride + long extension
    const s = computeStuff('FF', 99, 22, -8, 7.2)!;
    expect(s).toBeGreaterThan(120);
  });

  it('grades a flat, soft four-seam below average', () => {
    const s = computeStuff('FF', 89, 9, 2, 5.7)!;
    expect(s).toBeLessThan(90);
  });

  it('rewards depth on a curveball', () => {
    const nasty = computeStuff('CU', 82, -16, 12, 6.4)!; // hard, big depth + sweep
    const flat = computeStuff('CU', 74, -6, 3, 6.4)!;
    expect(nasty).toBeGreaterThan(flat);
  });

  it('always returns an integer clamped to [40, 175]', () => {
    const extreme = computeStuff('FF', 108, 30, -25, 8.5)!;
    const awful = computeStuff('FF', 80, 0, 0, 5.0)!;
    expect(Number.isInteger(extreme)).toBe(true);
    expect(extreme).toBeLessThanOrEqual(175);
    expect(awful).toBeGreaterThanOrEqual(40);
  });
});
