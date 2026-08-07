import { describe, expect, it } from 'vitest';
import { TtlCache } from '../src/cache.js';

describe('TtlCache', () => {
  it('stores and returns a value within its TTL', () => {
    const c = new TtlCache<number>(10);
    c.set('a', 1, 1000, 0);
    expect(c.get('a', 500)).toBe(1);
  });

  it('never caches a ttl <= 0 write', () => {
    const c = new TtlCache<number>(10);
    c.set('live', 1, 0, 0);
    c.set('live2', 2, -5, 0);
    expect(c.get('live', 0)).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('lazily drops an expired entry on read', () => {
    const c = new TtlCache<number>(10);
    c.set('a', 1, 1000, 0);
    expect(c.get('a', 2000)).toBeUndefined(); // expired
    expect(c.size).toBe(0); // and removed
  });

  it('bounds the entry count with LRU eviction', () => {
    const c = new TtlCache<number>(3);
    c.set('a', 1, 1000, 0);
    c.set('b', 2, 1000, 0);
    c.set('c', 3, 1000, 0);
    // touch 'a' so 'b' becomes least-recently-used
    expect(c.get('a', 10)).toBe(1);
    c.set('d', 4, 1000, 10); // over cap → evict LRU ('b')
    expect(c.size).toBe(3);
    expect(c.get('b', 10)).toBeUndefined();
    expect(c.get('a', 10)).toBe(1);
    expect(c.get('c', 10)).toBe(3);
    expect(c.get('d', 10)).toBe(4);
  });

  it('sweep removes only expired entries and reports the count', () => {
    const c = new TtlCache<number>(10);
    c.set('short', 1, 100, 0);
    c.set('long', 2, 10_000, 0);
    expect(c.sweep(500)).toBe(1); // 'short' expired, 'long' survives
    expect(c.size).toBe(1);
    expect(c.get('long', 500)).toBe(2);
  });
});

describe('TtlCache byte budget', () => {
  it('evicts least-recently-used entries until the byte budget is met', () => {
    const c = new TtlCache<string>(100, 300);
    c.set('a', 'x', 1000, { now: 0, bytes: 100 });
    c.set('b', 'y', 1000, { now: 0, bytes: 100 });
    c.set('c', 'z', 1000, { now: 0, bytes: 100 });
    expect(c.bytes).toBe(300);

    // Touch 'a' so 'b' is the least-recently-used, then overflow the budget.
    c.get('a', 10);
    c.set('d', 'w', 1000, { now: 10, bytes: 100 });

    expect(c.bytes).toBeLessThanOrEqual(300);
    expect(c.get('b', 10)).toBeUndefined(); // evicted
    expect(c.get('a', 10)).toBe('x');
    expect(c.get('d', 10)).toBe('w');
  });

  it('does not retain an entry larger than the whole budget', () => {
    const c = new TtlCache<string>(100, 1000);
    c.set('huge', 'payload', 1000, { now: 0, bytes: 5000 });
    expect(c.get('huge', 10)).toBeUndefined();
    expect(c.bytes).toBe(0);
    expect(c.size).toBe(0);
  });

  it('keeps byte accounting correct when a key is overwritten', () => {
    const c = new TtlCache<string>(100, 1000);
    c.set('k', 'a', 1000, { now: 0, bytes: 400 });
    c.set('k', 'b', 1000, { now: 0, bytes: 100 });
    expect(c.size).toBe(1);
    expect(c.bytes).toBe(100);
  });

  it('reclaims bytes on expiry and on sweep', () => {
    const c = new TtlCache<string>(100, 1000);
    c.set('short', 'a', 100, { now: 0, bytes: 200 });
    c.set('long', 'b', 10_000, { now: 0, bytes: 300 });
    expect(c.bytes).toBe(500);
    expect(c.sweep(500)).toBe(1);
    expect(c.bytes).toBe(300);
  });

  it('is unbounded by bytes when no budget is given', () => {
    const c = new TtlCache<string>(10);
    c.set('a', 'x', 1000, { now: 0, bytes: 10 ** 9 });
    expect(c.get('a', 10)).toBe('x');
  });
});
