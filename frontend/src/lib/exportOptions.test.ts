import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS, loadExportOptions, saveExportOptions } from './exportOptions';

/** In-memory localStorage so the merge/persist logic can be exercised in Node. */
function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  return store;
}

afterEach(() => vi.unstubAllGlobals());

describe('loadExportOptions', () => {
  it('returns the defaults when nothing is stored', () => {
    stubStorage();
    expect(loadExportOptions()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });

  it('merges a partial stored value over the defaults', () => {
    stubStorage({ exportOptions: JSON.stringify({ style: 'minimal', pitching: false }) });
    expect(loadExportOptions()).toEqual({ ...DEFAULT_EXPORT_OPTIONS, style: 'minimal', pitching: false });
  });

  it('falls back to defaults on corrupt JSON', () => {
    stubStorage({ exportOptions: '{not valid json' });
    expect(loadExportOptions()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });
});

describe('saveExportOptions', () => {
  it('round-trips through storage', () => {
    stubStorage();
    const chosen = { ...DEFAULT_EXPORT_OPTIONS, style: 'minimal' as const, inkSaver: true, legend: false };
    saveExportOptions(chosen);
    expect(loadExportOptions()).toEqual(chosen);
  });
});

describe('storage failures', () => {
  it('loadExportOptions returns defaults when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadExportOptions()).toEqual(DEFAULT_EXPORT_OPTIONS);
  });

  it('saveExportOptions swallows storage errors', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveExportOptions(DEFAULT_EXPORT_OPTIONS)).not.toThrow();
  });
});
