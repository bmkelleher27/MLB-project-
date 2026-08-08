interface Entry<T> {
  value: T;
  expiresAt: number;
  bytes: number;
}

export interface CacheSetOptions {
  /** Injectable clock for tests. */
  now?: number;
  /**
   * Approximate size of this value. Only meaningful when the cache was given a
   * byte budget; entries written without it count as zero and are bounded by
   * the entry cap alone.
   */
  bytes?: number;
}

/**
 * A tiny bounded TTL cache with LRU eviction.
 *
 * The MLB proxy caches many distinct keys over a long-running server's life
 * (every schedule date, season, player, team-season...). Without a bound those
 * entries — even expired ones — accumulate forever.
 *
 * Two independent bounds apply, because an entry cap alone does not bound
 * memory: MLB payloads range from a 5 KB zone chart to a 1.3 MB pitch log, so
 * 500 entries is anywhere from 3 MB to 800 MB. Callers that know a payload's
 * size pass it, and the cache evicts least-recently-used entries until both the
 * entry count and the byte budget are satisfied. A `ttlMs <= 0` write is
 * treated as "never cache".
 */
export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxBytes = Number.POSITIVE_INFINITY
  ) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.drop(key);
      return undefined;
    }
    // LRU touch: re-insert so this key becomes most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, options: number | CacheSetOptions = {}): void {
    if (ttlMs <= 0) return; // never cache (e.g. the always-fresh live feed)
    // A bare number keeps the original `set(key, value, ttl, now)` call shape.
    const { now = Date.now(), bytes = 0 } =
      typeof options === 'number' ? { now: options, bytes: 0 } : options;

    this.drop(key);
    this.map.set(key, { value, expiresAt: now + ttlMs, bytes });
    this.totalBytes += bytes;

    // An entry larger than the whole budget would otherwise evict everything
    // and still not fit, so it is stored and then immediately dropped.
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.drop(oldest);
      if (oldest === key) break; // the new entry itself was too big
    }
  }

  private drop(key: string): void {
    const entry = this.map.get(key);
    if (!entry) return;
    this.totalBytes -= entry.bytes;
    this.map.delete(key);
  }

  /** Drop all expired entries; returns how many were removed. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.drop(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.map.size;
  }

  /** Approximate bytes held, for health reporting. */
  get bytes(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.map.clear();
    this.totalBytes = 0;
  }
}
