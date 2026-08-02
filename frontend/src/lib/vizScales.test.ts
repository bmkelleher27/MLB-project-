import { describe, expect, it } from 'vitest';
import { divergingBin, formatZoneValue, maxDeviation, sequentialBin } from './vizScales';

describe('sequentialBin', () => {
  it('puts the minimum in the first bin and the maximum in the last', () => {
    expect(sequentialBin(0, 0, 100, 5)).toBe(0);
    expect(sequentialBin(100, 0, 100, 5)).toBe(4);
  });

  it('spreads intermediate values across the ramp', () => {
    expect(sequentialBin(25, 0, 100, 5)).toBe(1);
    expect(sequentialBin(50, 0, 100, 5)).toBe(2);
    expect(sequentialBin(75, 0, 100, 5)).toBe(3);
  });

  it('clamps values outside the range instead of overflowing the ramp', () => {
    expect(sequentialBin(-10, 0, 100, 5)).toBe(0);
    expect(sequentialBin(300, 0, 100, 5)).toBe(4);
  });

  it('falls back to the middle bin when every value is identical', () => {
    expect(sequentialBin(7, 7, 7, 5)).toBe(2);
  });

  it('never returns a bin outside 0..bins-1', () => {
    for (let v = -50; v <= 150; v += 7) {
      const bin = sequentialBin(v, 0, 100, 5);
      expect(bin).toBeGreaterThanOrEqual(0);
      expect(bin).toBeLessThanOrEqual(4);
    }
  });
});

describe('divergingBin', () => {
  it('puts a value at the midpoint in the neutral middle bin', () => {
    expect(divergingBin(0.8, 0.8, 0.4)).toBe(2);
  });

  it('sends values below the midpoint to the cool arm and above to the warm arm', () => {
    expect(divergingBin(0.4, 0.8, 0.4)).toBe(0);
    expect(divergingBin(1.2, 0.8, 0.4)).toBe(4);
  });

  it('uses the intermediate bins for moderate deviations', () => {
    expect(divergingBin(0.68, 0.8, 0.4)).toBe(1);
    expect(divergingBin(0.92, 0.8, 0.4)).toBe(3);
  });

  it('is symmetric about the midpoint', () => {
    const below = divergingBin(0.5, 1, 0.5);
    const above = divergingBin(1.5, 1, 0.5);
    expect(below).toBe(0);
    expect(above).toBe(4);
  });

  it('returns neutral when the spread is zero or the inputs are not finite', () => {
    expect(divergingBin(1, 1, 0)).toBe(2);
    expect(divergingBin(Number.NaN, 1, 0.5)).toBe(2);
  });
});

describe('maxDeviation', () => {
  it('finds the largest absolute distance from the midpoint', () => {
    expect(maxDeviation([0.5, 1.0, 1.4], 1)).toBeCloseTo(0.5);
  });

  it('ignores non-finite entries', () => {
    expect(maxDeviation([1.2, Number.NaN, 0.9], 1)).toBeCloseTo(0.2);
  });

  it('is zero for an empty grid', () => {
    expect(maxDeviation([], 1)).toBe(0);
  });
});

describe('formatZoneValue', () => {
  it('drops the leading zero on sub-1.000 rate stats', () => {
    expect(formatZoneValue(0.333, 'battingAverage')).toBe('.333');
  });

  it('keeps the leading digit once a rate exceeds 1.000', () => {
    expect(formatZoneValue(1.25, 'onBasePlusSlugging')).toBe('1.250');
  });

  it('formats exit velocity to one decimal and pitch counts as integers', () => {
    expect(formatZoneValue(91.99, 'exitVelocity')).toBe('92.0');
    expect(formatZoneValue(186, 'numberOfPitches')).toBe('186');
  });

  it('formats ERA to two decimals', () => {
    expect(formatZoneValue(3.4159, 'earnedRunAverage')).toBe('3.42');
  });

  it('shows an em dash for a zone with no data', () => {
    expect(formatZoneValue(null, 'onBasePlusSlugging')).toBe('—');
  });
});
