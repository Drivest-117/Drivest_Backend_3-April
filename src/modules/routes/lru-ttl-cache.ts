export class LruTtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number = 500,
    private readonly ttlMs: number = 120_000,
  ) {}

  get(key: string): T | null {
    if (this.maxEntries <= 0 || this.ttlMs <= 0) return null;

    const hit = this.store.get(key);
    if (!hit) return null;

    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    // Touch entry for LRU behavior.
    this.store.delete(key);
    this.store.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.maxEntries <= 0 || this.ttlMs <= 0) return;

    const expiresAt = Date.now() + this.ttlMs;
    if (this.store.has(key)) {
      this.store.delete(key);
    }
    this.store.set(key, { value, expiresAt });

    this.evictExpired();
    this.evictLru();
  }

  size(): number {
    return this.store.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  private evictLru(): void {
    while (this.store.size > this.maxEntries) {
      const lru = this.store.keys().next().value as string | undefined;
      if (!lru) return;
      this.store.delete(lru);
    }
  }
}

