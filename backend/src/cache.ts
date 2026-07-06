interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A tiny bounded TTL cache with LRU eviction.
 *
 * The MLB proxy caches many distinct keys over a long-running server's life
 * (every schedule date, season, player, team-season...). Without a bound those
 * entries — even expired ones — accumulate forever. This caps the entry count
 * (evicting least-recently-used) and lazily drops expired entries on read, so
 * memory stays bounded. A `ttlMs <= 0` write is treated as "never cache".
 */
export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    // LRU touch: re-insert so this key becomes most-recently-used.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (ttlMs <= 0) return; // never cache (e.g. the always-fresh live feed)
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: now + ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  /** Drop all expired entries; returns how many were removed. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
