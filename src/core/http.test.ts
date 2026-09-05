import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ApiError,
  buildUrl,
  createHttpClient,
  type FetchLike,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "./index.js";

function fakeFetch(responses: Array<() => Response | Promise<Response>>): FetchLike & {
  calls: Array<{ url: string; init: RequestInit | undefined }>;
} {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fn: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next();
  };
  return Object.assign(fn, { calls });
}

const noSleep = async () => {};

describe("buildUrl", () => {
  it("joins base and path and drops empty query params", () => {
    const url = buildUrl("https://www.data.gouv.fr/api/", "2/datasets/search/", {
      q: "population",
      page: 1,
      sort: undefined,
      empty: "",
    });
    expect(url.href).toBe("https://www.data.gouv.fr/api/2/datasets/search/?q=population&page=1");
  });
});

describe("FetchHttpClient", () => {
  it("sends the User-Agent and validates JSON with a schema", async () => {
    const fetchImpl = fakeFetch([() => Response.json({ total: 3 })]);
    const http = createHttpClient({ timeoutMs: 1000, retries: 0, fetchImpl, sleep: noSleep });
    const body = await http.getJson("https://example.org/x", {
      schema: z.object({ total: z.number() }),
    });
    expect(body.total).toBe(3);
    const headers = fetchImpl.calls[0]?.init?.headers as Record<string, string>;
    expect(headers["user-agent"]).toMatch(/^datagouv-mcp\//);
  });

  it("throws ValidationError when the body does not match the schema", async () => {
    const http = createHttpClient({
      timeoutMs: 1000,
      retries: 0,
      fetchImpl: fakeFetch([() => Response.json({ total: "x" })]),
      sleep: noSleep,
    });
    await expect(
      http.getJson("https://example.org/x", { schema: z.object({ total: z.number() }) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("retries on 503 then succeeds", async () => {
    const fetchImpl = fakeFetch([
      () => new Response("down", { status: 503 }),
      () => Response.json({ ok: true }),
    ]);
    const http = createHttpClient({ timeoutMs: 1000, retries: 2, fetchImpl, sleep: noSleep });
    expect(await http.getJson("https://example.org/x")).toEqual({ ok: true });
    expect(fetchImpl.calls.length).toBe(2);
  });

  it("maps 404 to NotFoundError with a custom message and does not retry", async () => {
    const fetchImpl = fakeFetch([() => new Response("nope", { status: 404 })]);
    const http = createHttpClient({ timeoutMs: 1000, retries: 2, fetchImpl, sleep: noSleep });
    await expect(
      http.getJson("https://example.org/x", { notFoundMessage: "Dataset 'x' not found" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Dataset 'x' not found" });
    expect(fetchImpl.calls.length).toBe(1);
  });

  it("maps exhausted 429 to RateLimitError and 500 to ApiError", async () => {
    const http429 = createHttpClient({
      timeoutMs: 1000,
      retries: 0,
      fetchImpl: fakeFetch([
        () => new Response("", { status: 429, headers: { "retry-after": "2" } }),
      ]),
      sleep: noSleep,
    });
    const err = await http429.getJson("https://example.org/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterMs).toBe(2000);

    const http500 = createHttpClient({
      timeoutMs: 1000,
      retries: 0,
      fetchImpl: fakeFetch([() => new Response("boom", { status: 500 })]),
      sleep: noSleep,
    });
    const err500 = await http500.getJson("https://example.org/x").catch((e: unknown) => e);
    expect(err500).toBeInstanceOf(ApiError);
    expect((err500 as ApiError).status).toBe(500);
    expect((err500 as ApiError).retryable).toBe(true);
  });

  it("maps abort/timeout errors to TimeoutError", async () => {
    const fetchImpl: FetchLike = async () => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      throw error;
    };
    const http = createHttpClient({ timeoutMs: 5, retries: 0, fetchImpl, sleep: noSleep });
    await expect(http.getJson("https://example.org/slow")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("readBodyBounded rejects bodies above the limit", async () => {
    const http = createHttpClient({ timeoutMs: 1000, retries: 0, fetchImpl: fakeFetch([]) });
    const small = await http.readBodyBounded(new Response("abc"), 10);
    expect(new TextDecoder().decode(small)).toBe("abc");
    await expect(http.readBodyBounded(new Response("x".repeat(100)), 10)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });
});
