import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MockAgent, fetch as undiciFetch } from "undici";
import type { MockInterceptor } from "undici/types/mock-interceptor.js";
import { type ApiBaseUrls, resolveBaseUrls } from "../../src/core/config.js";
import type { FetchLike } from "../../src/core/http.js";

/**
 * undici `MockAgent` wrapper for contract / e2e tests.
 *
 * Every upstream service the server talks to (udata v1/v2, Tabular API, Metrics,
 * Crawler, schema.data.gouv.fr, Validata) has a route builder. Responses can be
 * inline JSON or a recorded fixture name resolved under `tests/fixtures/api/`
 * (recorded by `pnpm fixtures:record`) with a fallback to `tests/fixtures/`.
 *
 * ```ts
 * const mock = mockDatagouv();
 * mock.v2("/datasets/search/", { fixture: "datagouv/datasets-search-population" });
 * mock.v1("/datasets/53699d0ea3a729239d205b2e/", { json: { id: "…" } });
 * mock.tabular("/resources/<rid>/profile/", { status: 404, json: { detail: "not found" } });
 * const server = await startTestServer({ fetchImpl: mock.fetchImpl });
 * …
 * mock.assertNoPendingInterceptors(); // optional, strict tests
 * ```
 *
 * Unmatched requests fail fast (`net.connect` disabled) so a missing route
 * shows up as an explicit `NETWORK_ERROR` instead of a live call.
 */

export type FixtureName = string;

export interface MockReply {
  /** HTTP status (default 200). */
  status?: number;
  /** Inline JSON body (serialised). */
  json?: unknown;
  /** Raw text body (takes precedence over `json`). */
  text?: string;
  /** Raw bytes (takes precedence over `text`/`json`). */
  body?: Uint8Array;
  /** Fixture name relative to `tests/fixtures/api/` without `.json`, e.g. `datagouv/dataset-population`. */
  fixture?: FixtureName;
  headers?: Record<string, string>;
  /** Match only this HTTP method (default GET; use `"HEAD"` for availability probes). */
  method?: "GET" | "HEAD" | "POST";
  /** Match query parameters (subset). Omit to match any query string. */
  query?: Record<string, string | number>;
  /** Number of times this route may be hit (default: unlimited / persistent). */
  times?: number;
  /** Simulated latency in milliseconds. */
  delayMs?: number;
  /** Dynamic body computed from the intercepted request (overrides static bodies). */
  respond?: (request: { path: string; query: URLSearchParams; method: string }) => {
    status?: number;
    json?: unknown;
    text?: string;
    headers?: Record<string, string>;
  };
}

export interface RecordedCall {
  origin: string;
  method: string;
  path: string;
  url: string;
}

export interface DatagouvMock {
  agent: MockAgent;
  /** Base URLs the routes are registered on (prod by default). */
  baseUrls: ApiBaseUrls;
  /** Pass to `createDeps(config, { fetchImpl })` / `startTestServer({ fetchImpl })`. */
  fetchImpl: FetchLike & { calls: RecordedCall[] };
  /** udata API v1, path relative to `/api/1/` (leading slash optional). */
  v1(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** udata API v2, path relative to `/api/2/`. */
  v2(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** Public site (e.g. `/datasets/r/<id>` redirects, HTML pages). Path relative to site root. */
  site(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** tabular-api.data.gouv.fr, path relative to `/api/`. */
  tabular(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** metric-api.data.gouv.fr, path relative to `/api/`. */
  metrics(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** crawler.data.gouv.fr, path relative to `/api/`. */
  crawler(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** schema.data.gouv.fr, path relative to root. */
  schema(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** Validata API, path relative to root. */
  validata(path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** Arbitrary origin (resource files hosted anywhere): `mock.url("https://static.example/file.csv", …)`. */
  url(absoluteUrl: string, reply?: MockReply): DatagouvMock;
  /** Register a route on any origin with an absolute path matcher. */
  route(origin: string, path: PathMatcher, reply?: MockReply): DatagouvMock;
  /** Calls seen so far (in order). */
  calls: RecordedCall[];
  /** Throws if any non-persistent interceptor was not consumed. */
  assertNoPendingInterceptors(): void;
  close(): Promise<void>;
}

/** Absolute path string (query ignored), RegExp on `path?query`, or predicate on `path?query`. */
export type PathMatcher = string | RegExp | ((pathWithQuery: string) => boolean);

const FIXTURE_ROOTS = ["tests/fixtures/api", "tests/fixtures"];

interface MockScopeLike {
  delay(waitInMs: number): MockScopeLike;
  persist(): MockScopeLike;
  times(repeatTimes: number): MockScopeLike;
}

/** Load a recorded fixture (`datagouv/dataset-population` → `tests/fixtures/api/datagouv/dataset-population.json`). */
export function loadFixture<T = unknown>(name: FixtureName): T {
  return JSON.parse(loadFixtureText(name)) as T;
}

export function loadFixtureText(name: FixtureName): string {
  const file = name.endsWith(".json") ? name : `${name}.json`;
  for (const root of FIXTURE_ROOTS) {
    const path = resolve(process.cwd(), root, file);
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error(
    `Fixture not found: ${name} (looked in ${FIXTURE_ROOTS.join(", ")}). Record it with \`pnpm fixtures:record\`.`,
  );
}

function joinPath(prefix: string, path: string): string {
  const cleaned = path.startsWith("/") ? path.slice(1) : path;
  return `${prefix}${cleaned}`;
}

function toInterceptorPath(prefix: string, matcher: PathMatcher): MockInterceptor.Options["path"] {
  if (typeof matcher === "string") {
    const full = joinPath(prefix, matcher);
    return (pathWithQuery: string) => {
      const [pathname = ""] = pathWithQuery.split("?");
      return pathname === full || pathname === `${full}/` || `${pathname}/` === full;
    };
  }
  if (matcher instanceof RegExp) return matcher;
  return matcher;
}

function originAndPrefix(base: string): { origin: string; prefix: string } {
  const url = new URL(base);
  return {
    origin: url.origin,
    prefix: url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`,
  };
}

function bodyFor(reply: MockReply): { body: string | Uint8Array; contentType: string | undefined } {
  if (reply.body) return { body: reply.body, contentType: "application/octet-stream" };
  if (reply.text !== undefined)
    return { body: reply.text, contentType: "text/plain; charset=utf-8" };
  if (reply.fixture)
    return { body: loadFixtureText(reply.fixture), contentType: "application/json" };
  if (reply.json !== undefined)
    return { body: JSON.stringify(reply.json), contentType: "application/json" };
  return { body: "", contentType: undefined };
}

export interface MockDatagouvOptions {
  env?: "prod" | "demo";
  /** Override base URLs (e.g. when the config under test uses custom hosts). */
  baseUrls?: ApiBaseUrls;
}

export function mockDatagouv(options: MockDatagouvOptions = {}): DatagouvMock {
  const baseUrls = options.baseUrls ?? resolveBaseUrls(options.env ?? "prod");
  const agent = new MockAgent({ connections: 1 });
  agent.disableNetConnect();
  const calls: RecordedCall[] = [];

  const fetchImpl = Object.assign(
    (async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push({
        origin: url.origin,
        method: init?.method ?? "GET",
        path: url.pathname,
        url: url.href,
      });
      // undici's fetch types differ slightly from the DOM lib ones; the runtime objects are compatible.
      return (await undiciFetch(url, {
        ...(init as Parameters<typeof undiciFetch>[1]),
        dispatcher: agent,
      })) as unknown as Response;
    }) as FetchLike,
    { calls },
  );

  function route(
    origin: string,
    matcher: PathMatcher,
    prefix: string,
    reply: MockReply = {},
  ): DatagouvMock {
    const pool = agent.get(origin);
    const interceptor = pool.intercept({
      path: toInterceptorPath(prefix, matcher),
      method: reply.method ?? "GET",
      ...(reply.query ? { query: reply.query } : {}),
    });
    const status = reply.status ?? 200;
    let scope: MockScopeLike;
    if (reply.respond) {
      const respond = reply.respond;
      scope = interceptor.reply((opts) => {
        const [path = "", query = ""] = opts.path.split("?");
        const out = respond({ path, query: new URLSearchParams(query), method: opts.method });
        const body = out.text ?? (out.json !== undefined ? JSON.stringify(out.json) : "");
        return {
          statusCode: out.status ?? status,
          data: body,
          responseOptions: {
            headers: {
              "content-type":
                out.text !== undefined ? "text/plain; charset=utf-8" : "application/json",
              ...reply.headers,
              ...out.headers,
            },
          },
        };
      });
    } else {
      const { body, contentType } = bodyFor(reply);
      scope = interceptor.reply(status, body, {
        headers: { ...(contentType ? { "content-type": contentType } : {}), ...reply.headers },
      });
    }
    if (reply.delayMs) scope.delay(reply.delayMs);
    if (reply.times === undefined) scope.persist();
    else scope.times(reply.times);
    return mock;
  }

  const datagouvApi = originAndPrefix(baseUrls.datagouvApi);
  const site = originAndPrefix(baseUrls.site);
  const tabular = originAndPrefix(baseUrls.tabularApi);
  const metrics = originAndPrefix(baseUrls.metricsApi);
  const crawler = originAndPrefix(baseUrls.crawlerApi);
  const schema = originAndPrefix(baseUrls.schemaCatalog);
  const validata = originAndPrefix(baseUrls.validataApi);

  const mock: DatagouvMock = {
    agent,
    baseUrls,
    fetchImpl,
    calls,
    v1: (path, reply) => route(datagouvApi.origin, path, `${datagouvApi.prefix}1/`, reply),
    v2: (path, reply) => route(datagouvApi.origin, path, `${datagouvApi.prefix}2/`, reply),
    site: (path, reply) => route(site.origin, path, site.prefix, reply),
    tabular: (path, reply) => route(tabular.origin, path, tabular.prefix, reply),
    metrics: (path, reply) => route(metrics.origin, path, metrics.prefix, reply),
    crawler: (path, reply) => route(crawler.origin, path, crawler.prefix, reply),
    schema: (path, reply) => route(schema.origin, path, schema.prefix, reply),
    validata: (path, reply) => route(validata.origin, path, validata.prefix, reply),
    url: (absoluteUrl, reply) => {
      const u = new URL(absoluteUrl);
      return route(u.origin, `${u.pathname}`, "", reply);
    },
    route: (origin, path, reply) => route(new URL(origin).origin, path, "", reply),
    assertNoPendingInterceptors: () => agent.assertNoPendingInterceptors(),
    close: () => agent.close(),
  };
  return mock;
}

/** Common udata v2 paginated envelope around `items` (handy when no fixture exists yet). */
export function v2Page<T>(
  items: T[],
  overrides: Partial<{
    page: number;
    page_size: number;
    total: number;
    next_page: string | null;
  }> = {},
): Record<string, unknown> {
  return {
    data: items,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? Math.max(items.length, 1),
    total: overrides.total ?? items.length,
    next_page: overrides.next_page ?? null,
    previous_page: null,
  };
}

/** Tabular API `/data/` envelope. */
export function tabularPage(
  rows: Array<Record<string, unknown>>,
  overrides: Partial<{ page: number; page_size: number; total: number; next: string | null }> = {},
): Record<string, unknown> {
  return {
    data: rows,
    links: { next: overrides.next ?? null, prev: null, profile: null, swagger: null },
    meta: {
      page: overrides.page ?? 1,
      page_size: overrides.page_size ?? Math.max(rows.length, 1),
      total: overrides.total ?? rows.length,
    },
  };
}
