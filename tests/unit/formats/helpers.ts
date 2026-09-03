import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHttpClient, type HttpClient } from "../../../src/core/http.js";
import type {
  ResourceAnalysis,
  ResourceDetail,
  Row,
  TableSchema,
} from "../../../src/core/types.js";
import { createEngines } from "../../../src/formats/engines/index.js";
import type {
  AccessContext,
  CapabilityReport,
  FormatsDeps,
  TabularDataSource,
} from "../../../src/formats/types.js";

export const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "fixtures",
  "files",
);

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES_DIR, name)));
}

export const emptyAnalysis: ResourceAnalysis = {
  checkAvailable: undefined,
  checkStatus: undefined,
  checkError: undefined,
  checkDate: undefined,
  detectedMime: undefined,
  contentLength: undefined,
  analysisError: undefined,
  parsingTable: undefined,
  parsingError: undefined,
  parquetUrl: undefined,
  parquetSize: undefined,
  geojsonUrl: undefined,
  pmtilesUrl: undefined,
  ogcMetadata: undefined,
  validation: undefined,
};

export function resource(
  overrides: Partial<Omit<ResourceDetail, "analysis">> & {
    analysis?: Partial<ResourceAnalysis>;
  } = {},
): ResourceDetail {
  const id = overrides.id ?? "res-0000";
  const { analysis, ...rest } = overrides;
  return {
    id,
    title: "Test resource",
    description: undefined,
    format: "csv",
    mime: undefined,
    type: "main",
    filetype: "file",
    filesize: undefined,
    url: `https://static.data.gouv.fr/resources/test/${id}.csv`,
    latestUrl: `https://www.data.gouv.fr/api/1/datasets/r/${id}`,
    previewUrl: undefined,
    createdAt: undefined,
    lastModified: undefined,
    schema: undefined,
    datasetId: "ds-1",
    checksum: undefined,
    extras: {},
    ...rest,
    analysis: { ...emptyAnalysis, ...analysis },
  };
}

/** Route table for a fake fetch: exact URL (without query) or prefix → response factory. */
export type FakeRoute = (url: URL, init: RequestInit | undefined) => Response | undefined;

export function fakeFetch(routes: Record<string, Uint8Array | string | FakeRoute>) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];
  const impl = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const headers = Object.fromEntries(
      Object.entries((init?.headers as Record<string, string>) ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        v,
      ]),
    );
    calls.push({ url: url.toString(), method: init?.method ?? "GET", headers });
    const key = Object.keys(routes).find(
      (k) => url.toString() === k || url.toString().startsWith(k),
    );
    if (key === undefined) return new Response("not found", { status: 404 });
    const route = routes[key];
    if (route === undefined) return new Response("not found", { status: 404 });
    if (typeof route === "function") {
      return route(url, init) ?? new Response("not found", { status: 404 });
    }
    return binaryResponse(route, init, headers.range);
  };
  return { fetch: impl, calls };
}

export function binaryResponse(
  body: Uint8Array | string,
  init: RequestInit | undefined,
  range?: string,
  contentType = "application/octet-stream",
): Response {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    "content-type": contentType,
    "content-length": String(bytes.byteLength),
    "accept-ranges": "bytes",
  };
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (match) {
    const start = Number(match[1]);
    const end =
      match[2] === "" ? bytes.byteLength - 1 : Math.min(Number(match[2]), bytes.byteLength - 1);
    const slice = bytes.subarray(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(slice.byteLength),
        "content-range": `bytes ${start}-${end}/${bytes.byteLength}`,
      },
    });
  }
  return new Response(bytes, { status: 200, headers });
}

export function testHttp(fetchImpl: typeof fetch): HttpClient {
  return createHttpClient({ timeoutMs: 5_000, retries: 0, fetchImpl });
}

export function fakeTabular(
  schema: TableSchema | undefined,
  rows: Row[] = [],
): TabularDataSource & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    getProfile: async () => schema,
    queryData: async (_id, query) => {
      calls.push(query);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      return { rows: rows.slice(start, start + pageSize), page, pageSize, total: rows.length };
    },
    isAggregationAllowed: async () => false,
  };
}

export function testDeps(http: HttpClient, overrides: Partial<FormatsDeps> = {}): FormatsDeps {
  return {
    http,
    tabular: undefined,
    tabularApiBaseUrl: "https://tabular-api.data.gouv.fr",
    maxDownloadBytes: 5 * 1024 * 1024,
    engines: createEngines({ http, maxDownloadBytes: 5 * 1024 * 1024, enableDuckdb: false }),
    ...overrides,
  };
}

export function reportFor(
  res: ResourceDetail,
  overrides: Partial<CapabilityReport> = {},
): CapabilityReport {
  return {
    resourceId: res.id,
    primary: "stream_parse",
    capabilities: ["stream_parse", "metadata_only"],
    strategy: "stream-csv",
    confidence: "high",
    formatFamily: "tabular",
    detectedFormat: res.format,
    compression: undefined,
    reasons: [],
    urls: {
      download: res.url,
      latest: res.latestUrl,
      parquet: res.analysis.parquetUrl,
      geojson: res.analysis.geojsonUrl,
      preview: undefined,
      tabularApi: undefined,
    },
    sizeBytes: res.filesize,
    tabularProbe: "skipped",
    warnings: [],
    ...overrides,
  };
}

export function ctxFor(
  res: ResourceDetail,
  report: Partial<CapabilityReport> = {},
  extra: Partial<AccessContext> = {},
): AccessContext {
  return {
    resource: res,
    report: reportFor(res, report),
    maxDownloadBytes: 5 * 1024 * 1024,
    ...extra,
  };
}
