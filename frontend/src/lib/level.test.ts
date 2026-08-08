import { afterEach, describe, expect, it, vi } from 'vitest';
import { levelFromParam, setStoredLevel, storedLevel } from './level';

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('storedLevel', () => {
  it('defaults to the majors when nothing is stored', () => {
    stubStorage();
    expect(storedLevel()).toBe(1);
  });

  it('round-trips a stored level', () => {
    stubStorage();
    setStoredLevel(11);
    expect(storedLevel()).toBe(11);
  });

  it('ignores a stored value that is not a supported level', () => {
    stubStorage({ level: '22' }); // college — real sportId, not one we cover
    expect(storedLevel()).toBe(1);
  });

  it('falls back when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(storedLevel()).toBe(1);
    expect(() => setStoredLevel(11)).not.toThrow();
  });
});

describe('levelFromParam', () => {
  it('prefers a valid URL param so a link is honoured', () => {
    stubStorage({ level: '1' });
    expect(levelFromParam('12')).toBe(12);
  });

  it('falls back to the stored preference when the param is absent or bad', () => {
    stubStorage({ level: '11' });
    expect(levelFromParam(null)).toBe(11);
    expect(levelFromParam('nonsense')).toBe(11);
    expect(levelFromParam('999')).toBe(11);
  });
});
