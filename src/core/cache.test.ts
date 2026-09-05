import { describe, expect, it } from "vitest";
import { createCache, LruCache, NoopCache } from "./cache.js";

describe("LruCache", () => {
  it("stores and retrieves typed values", () => {
    const cache = new LruCache({ maxEntries: 10, defaultTtlMs: 60_000 });
    cache.set("a", { n: 1 });
    expect(cache.get<{ n: number }>("a")).toEqual({ n: 1 });
    expect(cache.get("missing")).toBeUndefined();
    expect(cache.size).toBe(1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.size).toBe(0);
  });

  it("evicts least recently used entries beyond maxEntries", () => {
    const cache = new LruCache({ maxEntries: 2, defaultTtlMs: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("expires entries after ttl using the injected clock", () => {
    let now = 1_000;
    const cache = new LruCache({ maxEntries: 10, defaultTtlMs: 100, now: () => now });
    cache.set("k", "v");
    expect(cache.get("k")).toBe("v");
    now += 101;
    expect(cache.get("k")).toBeUndefined();
  });

  it("deduplicates concurrent loads and caches the result", async () => {
    const cache = new LruCache({ maxEntries: 10, defaultTtlMs: 60_000 });
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return "value";
    };
    const [a, b] = await Promise.all([cache.getOrLoad("k", loader), cache.getOrLoad("k", loader)]);
    expect(a).toBe("value");
    expect(b).toBe("value");
    expect(calls).toBe(1);
    expect(await cache.getOrLoad("k", loader)).toBe("value");
    expect(calls).toBe(1);
  });

  it("returns a stale value on loader error when staleOnError is set", async () => {
    let now = 1_000;
    const cache = new LruCache({ maxEntries: 10, defaultTtlMs: 100, now: () => now });
    cache.set("k", new Set(["old"]));
    now += 200;
    const failing = async (): Promise<Set<string>> => {
      throw new Error("upstream down");
    };
    await expect(cache.getOrLoad("k", failing)).rejects.toThrow("upstream down");
    const stale = await cache.getOrLoad("k", failing, { staleOnError: true });
    expect([...stale]).toEqual(["old"]);
  });
});

describe("createCache", () => {
  it("returns a NoopCache when maxEntries is 0", async () => {
    const cache = createCache({ maxEntries: 0, defaultTtlMs: 1000 });
    expect(cache).toBeInstanceOf(NoopCache);
    cache.set("a", 1);
    expect(cache.get("a")).toBeUndefined();
    expect(await cache.getOrLoad("a", async () => 2)).toBe(2);
  });
});
