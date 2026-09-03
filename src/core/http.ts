import type { ZodType } from "zod";
import {
  ApiError,
  NetworkError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from "./errors.js";
import { childLogger, type Logger } from "./logger.js";
import { USER_AGENT } from "./version.js";

/**
 * Thin HTTP layer over the global `fetch` (undici) with:
 * - per-request timeout (AbortSignal),
 * - bounded retries with exponential backoff + jitter on 429/5xx/network errors,
 * - `Retry-After` support,
 * - mapping of HTTP failures to the error taxonomy,
 * - optional Zod validation of JSON bodies.
 *
 * `fetchImpl` is injectable so tests can pass a fake or an undici `MockAgent` fetch.
 */

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "HEAD";
  query?: QueryParams;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Override the client-level retry count for this call (0 disables). */
  retries?: number;
  signal?: AbortSignal;
  /** Treat 404 as `NotFoundError` with this message instead of generic `ApiError`. */
  notFoundMessage?: string;
}

export interface HttpClientOptions {
  timeoutMs: number;
  retries: number;
  fetchImpl?: FetchLike;
  userAgent?: string;
  logger?: Logger;
  /** Injectable sleep for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpClient {
  /** GET a JSON document; validates with `schema` when provided. */
  getJson<T = unknown>(
    url: string | URL,
    options?: RequestOptions & { schema?: ZodType<T> },
  ): Promise<T>;
  getText(url: string | URL, options?: RequestOptions): Promise<string>;
  /** Low-level: returns the `Response` (status already checked). Caller consumes the body. */
  request(url: string | URL, options?: RequestOptions): Promise<Response>;
  /** Read at most `maxBytes` of a response body; throws `PayloadTooLargeError` beyond that. */
  readBodyBounded(response: Response, maxBytes: number): Promise<Uint8Array>;
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function buildUrl(base: string, path: string, query?: QueryParams): URL {
  const url = new URL(path, base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class FetchHttpClient implements HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly log: Logger;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: HttpClientOptions) {
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs;
    this.retries = options.retries;
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.log = options.logger ?? childLogger("http");
    this.sleep = options.sleep ?? defaultSleep;
  }

  async getJson<T = unknown>(
    url: string | URL,
    options: RequestOptions & { schema?: ZodType<T> } = {},
  ): Promise<T> {
    const response = await this.request(url, {
      ...options,
      headers: { accept: "application/json", ...options.headers },
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ApiError("Upstream returned a non-JSON body", {
        status: response.status,
        url: String(url),
        cause: error,
      });
    }
    if (!options.schema) return body as T;
    const parsed = options.schema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Upstream response did not match the expected shape", {
        details: {
          url: String(url),
          issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`),
        },
      });
    }
    return parsed.data;
  }

  async getText(url: string | URL, options: RequestOptions = {}): Promise<string> {
    const response = await this.request(url, options);
    return response.text();
  }

  async request(url: string | URL, options: RequestOptions = {}): Promise<Response> {
    const target = String(url);
    const maxAttempts = (options.retries ?? this.retries) + 1;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      let response: Response;
      try {
        response = await this.fetchImpl(target, {
          method: options.method ?? "GET",
          headers: { "user-agent": this.userAgent, ...options.headers },
          signal: combineSignals(AbortSignal.timeout(timeoutMs), options.signal),
          redirect: "follow",
        });
      } catch (error) {
        const mapped = mapFetchError(error, target, timeoutMs);
        if (attempt < maxAttempts && !options.signal?.aborted) {
          this.log.warn({ url: target, attempt, err: mapped.code }, "retrying after network error");
          await this.sleep(backoffMs(attempt));
          continue;
        }
        throw mapped;
      }

      this.log.debug(
        { url: target, status: response.status, ms: Date.now() - started, attempt },
        "upstream request",
      );

      if (response.ok) return response;

      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
        await response.body?.cancel().catch(() => undefined);
        const delay = retryAfterMs ?? backoffMs(attempt);
        this.log.warn({ url: target, status: response.status, attempt, delay }, "retrying");
        await this.sleep(Math.min(delay, 10_000));
        continue;
      }

      throw await toHttpError(response, target, options, retryAfterMs);
    }
  }

  async readBodyBounded(response: Response, maxBytes: number): Promise<Uint8Array> {
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      throw new PayloadTooLargeError(`Response body is ${declared} bytes (limit ${maxBytes})`, {
        details: { contentLength: declared, maxBytes },
        hint: "Use the resource URL directly or a paginated/tabular access path instead.",
      });
    }
    if (!response.body) return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError(`Response body exceeds ${maxBytes} bytes`, {
          details: { maxBytes },
          hint: "Use the resource URL directly or a paginated/tabular access path instead.",
        });
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }
}

function backoffMs(attempt: number): number {
  const base = 250 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * base * 0.5);
}

function combineSignals(timeout: AbortSignal, external?: AbortSignal): AbortSignal {
  return external ? AbortSignal.any([timeout, external]) : timeout;
}

function mapFetchError(error: unknown, url: string, timeoutMs: number) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new TimeoutError(`Request to ${url} timed out after ${timeoutMs} ms`, {
      cause: error,
      details: { url, timeoutMs },
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  return new NetworkError(`Network error calling ${url}: ${message}`, {
    cause: error,
    details: { url },
  });
}

async function toHttpError(
  response: Response,
  url: string,
  options: RequestOptions,
  retryAfterMs: number | undefined,
) {
  const bodyText = await response.text().catch(() => "");
  const snippet = bodyText.slice(0, 500);
  if (response.status === 404) {
    return new NotFoundError(options.notFoundMessage ?? `Not found: ${url}`, {
      details: { url, status: 404 },
    });
  }
  if (response.status === 429) {
    return new RateLimitError(`Rate limited by ${new URL(url).host}`, {
      retryAfterMs,
      details: { url },
      hint: "Wait a moment before retrying; reduce page_size or parallel calls.",
    });
  }
  return new ApiError(`HTTP ${response.status} from ${new URL(url).host}`, {
    status: response.status,
    url,
    body: snippet,
  });
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  return new FetchHttpClient(options);
}
