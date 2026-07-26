import { describe, expect, it } from 'vitest';
import { stuffGrade } from './stuffGrade';

describe('stuffGrade', () => {
  it('grades 130+ as plus-plus', () => {
    expect(stuffGrade(130)).toMatchObject({ label: 'plus-plus', symbol: '++' });
    expect(stuffGrade(180).symbol).toBe('++');
  });

  it('grades 115–129 as plus', () => {
    expect(stuffGrade(115)).toMatchObject({ label: 'plus', symbol: '+' });
    expect(stuffGrade(129).symbol).toBe('+');
  });

  it('grades 85–114 as average with no symbol', () => {
    expect(stuffGrade(85)).toMatchObject({ label: 'average', symbol: '' });
    expect(stuffGrade(100).symbol).toBe('');
    expect(stuffGrade(114).symbol).toBe('');
  });

  it('grades below 85 as below average', () => {
    expect(stuffGrade(84)).toMatchObject({ label: 'below average', symbol: '−' });
    expect(stuffGrade(50).symbol).toBe('−');
  });

  it('carries a distinct className per band', () => {
    const classes = [stuffGrade(140), stuffGrade(120), stuffGrade(100), stuffGrade(70)].map((g) => g.className);
    expect(new Set(classes).size).toBe(4);
  });
});
