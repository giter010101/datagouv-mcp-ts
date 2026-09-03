import { LRUCache } from "lru-cache";

/**
 * Minimal cache abstraction. The default implementation is an in-memory LRU
 * (per process). Keys are namespaced strings, e.g. `datagouv:dataset:<id>`.
 */
export interface Cache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  delete(key: string): boolean;
  clear(): void;
  /**
   * Return the cached value or run `loader` (deduplicated: concurrent callers
   * for the same key share one in-flight promise). When `staleOnError` is set
   * and the loader throws, an expired value is returned if one is still held.
   */
  getOrLoad<T>(key: string, loader: () => Promise<T>, options?: GetOrLoadOptions): Promise<T>;
  readonly size: number;
}

export interface GetOrLoadOptions {
  ttlMs?: number;
  staleOnError?: boolean;
}

export interface CacheOptions {
  maxEntries: number;
  defaultTtlMs: number;
  /** Injectable clock for tests. */
  now?: () => number;
}

type Entry = { value: unknown };

export class LruCache implements Cache {
  private readonly store: LRUCache<string, Entry>;
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly defaultTtlMs: number;

  constructor(options: CacheOptions) {
    this.defaultTtlMs = options.defaultTtlMs;
    this.store = new LRUCache<string, Entry>({
      max: Math.max(1, options.maxEntries),
      ttl: options.defaultTtlMs > 0 ? options.defaultTtlMs : undefined,
      allowStale: false,
      noDeleteOnStaleGet: true,
      updateAgeOnGet: false,
      // Injected clock: disable lru-cache's timer-based "now" caching so tests are synchronous.
      ...(options.now ? { perf: { now: options.now }, ttlResolution: 0 } : {}),
    });
  }

  get size(): number {
    return this.store.size;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    return entry === undefined ? undefined : (entry.value as T);
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (ttl > 0) {
      this.store.set(key, { value }, { ttl });
    } else {
      this.store.set(key, { value });
    }
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    options: GetOrLoadOptions = {},
  ): Promise<T> {
    const fresh = this.get<T>(key);
    if (fresh !== undefined) return fresh;

    const pending = this.inflight.get(key);
    if (pending !== undefined) return pending as Promise<T>;

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, options.ttlMs);
        return value;
      } catch (error) {
        if (options.staleOnError) {
          const stale = this.store.get(key, { allowStale: true });
          if (stale !== undefined) return stale.value as T;
        }
        throw error;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }
}

/** A cache that stores nothing (useful for tests and `CACHE_MAX_ENTRIES=0`). */
export class NoopCache implements Cache {
  readonly size = 0;
  get<T>(): T | undefined {
    return undefined;
  }
  set(): void {}
  delete(): boolean {
    return false;
  }
  clear(): void {}
  getOrLoad<T>(_key: string, loader: () => Promise<T>): Promise<T> {
    return loader();
  }
}

export function createCache(options: CacheOptions): Cache {
  return options.maxEntries <= 0 ? new NoopCache() : new LruCache(options);
}
