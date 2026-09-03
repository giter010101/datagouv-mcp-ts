import { createGunzip, constants as zlibConstants } from "node:zlib";
import { detect as detectEncoding } from "chardet";
import iconv from "iconv-lite";
import {
  ApiError,
  FormatError,
  isDatagouvError,
  NotFoundError,
  PayloadTooLargeError,
  ResourceUnavailableError,
} from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import { sniffBytes } from "./sniff.js";

/**
 * Bounded, streaming download of resource files. All in-process parsing goes
 * through here so memory stays bounded by `maxBytes`, whatever the publisher
 * serves (gzip, wrong content-type, dead link, 5 GB file…).
 */

export interface ProbeResult {
  ok: boolean;
  status: number;
  contentType: string | undefined;
  contentLength: number | undefined;
  lastModified: string | undefined;
  acceptRanges: boolean;
  finalUrl: string;
}

export interface DownloadOptions {
  maxBytes: number;
  /**
   * `throw` (default): exceed → `PayloadTooLargeError`.
   * `truncate`: keep the first `maxBytes` and set `truncated: true` (previews of huge CSVs).
   */
  onOverflow?: "throw" | "truncate";
  /** Transparently gunzip when the bytes are gzip (default true). */
  decompress?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Ask the server for a byte range (used for sniffing and partial reads). */
  range?: { start: number; end?: number };
}

export interface DownloadResult {
  bytes: Uint8Array;
  finalUrl: string;
  status: number;
  contentType: string | undefined;
  /** Declared `content-length` of the response (before decompression). */
  contentLength: number | undefined;
  compression: "gzip" | undefined;
  truncated: boolean;
  /** True when the server honoured a `Range` request (206). */
  partial: boolean;
}

export interface DecodedText {
  text: string;
  encoding: string;
  bom: boolean;
}

function header(response: Response, name: string): string | undefined {
  return response.headers.get(name) ?? undefined;
}

function contentLengthOf(response: Response): number | undefined {
  const value = Number(header(response, "content-length"));
  return Number.isFinite(value) && value >= 0 && header(response, "content-length")
    ? value
    : undefined;
}

/** Map upstream failures on a *resource host* to the taxonomy (dead link ≠ API error). */
export function toDownloadError(error: unknown, url: string): Error {
  if (error instanceof NotFoundError || (error instanceof ApiError && error.status < 500)) {
    const status = error instanceof ApiError ? error.status : 404;
    return new ResourceUnavailableError(`The resource URL returned HTTP ${status}: ${url}`, {
      cause: error,
      details: { url, status },
      hint: "The link is dead or restricted. Use another resource of the dataset or its `latest` URL; check_resource_availability gives details.",
    });
  }
  if (isDatagouvError(error)) return error;
  return new ResourceUnavailableError(
    `Could not download ${url}: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error, details: { url } },
  );
}

/** HEAD probe (falls back to a 0-byte ranged GET when HEAD is refused). */
export async function probeUrl(
  http: HttpClient,
  url: string,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ProbeResult> {
  const attempt = async (method: "HEAD" | "GET") => {
    const response = await http.request(url, {
      method,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      retries: 0,
      headers: method === "GET" ? { range: "bytes=0-0" } : {},
    });
    if (method === "GET") await response.body?.cancel().catch(() => undefined);
    const contentRange = header(response, "content-range");
    const total = contentRange ? Number(contentRange.split("/")[1]) : undefined;
    return {
      ok: response.ok,
      status: response.status,
      contentType: header(response, "content-type"),
      contentLength:
        total !== undefined && Number.isFinite(total) ? total : contentLengthOf(response),
      lastModified: header(response, "last-modified"),
      acceptRanges: header(response, "accept-ranges") === "bytes" || response.status === 206,
      finalUrl: response.url || url,
    } satisfies ProbeResult;
  };
  try {
    return await attempt("HEAD");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 405 || error.status === 403)) {
      try {
        return await attempt("GET");
      } catch (inner) {
        throw toDownloadError(inner, url);
      }
    }
    throw toDownloadError(error, url);
  }
}

async function readStream(
  response: Response,
  maxBytes: number,
  onOverflow: "throw" | "truncate",
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!response.body) return { bytes: new Uint8Array(0), truncated: false };
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.byteLength > maxBytes) {
      if (onOverflow === "throw") {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError(`Download exceeds the ${maxBytes}-byte in-process cap`, {
          details: { maxBytes },
          hint: "Use the Tabular API or Parquet access path, filter server-side, or use the download URL directly.",
        });
      }
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes: out, truncated };
}

/**
 * Gunzip with an output cap. `truncate` keeps the first `maxBytes` of the
 * inflated stream (also tolerates truncated gzip input); `throw` raises
 * `PayloadTooLargeError` when the inflated size exceeds the cap.
 */
export function gunzipBounded(
  bytes: Uint8Array,
  maxBytes: number,
  onOverflow: "throw" | "truncate",
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const gunzip = createGunzip({ finishFlush: zlibConstants.Z_SYNC_FLUSH });
    const finish = (truncated: boolean) => {
      if (settled) return;
      settled = true;
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve({ bytes: out, truncated });
    };
    gunzip.on("data", (chunk: Buffer) => {
      if (settled) return;
      if (total + chunk.byteLength > maxBytes) {
        if (onOverflow === "throw") {
          settled = true;
          gunzip.destroy();
          reject(
            new PayloadTooLargeError(`Decompressed content exceeds the ${maxBytes}-byte cap`, {
              details: { maxBytes },
              hint: "Use the Tabular API / Parquet path or the download URL directly.",
            }),
          );
          return;
        }
        chunks.push(new Uint8Array(chunk.subarray(0, maxBytes - total)));
        total = maxBytes;
        gunzip.destroy();
        finish(true);
        return;
      }
      chunks.push(new Uint8Array(chunk));
      total += chunk.byteLength;
    });
    gunzip.on("end", () => finish(false));
    gunzip.on("error", (error: Error) => {
      if (settled) return;
      // Truncated/corrupt tail: keep the decodable prefix when the caller tolerates truncation.
      if (onOverflow === "truncate" && total > 0) finish(true);
      else {
        settled = true;
        reject(
          new FormatError(`Invalid gzip stream: ${error.message}`, {
            cause: error,
            hint: "The file is not a valid gzip archive; try the download URL directly.",
          }),
        );
      }
    });
    gunzip.end(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  });
}

export async function downloadBounded(
  http: HttpClient,
  url: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  const onOverflow = options.onOverflow ?? "throw";
  const headers: Record<string, string> = { "accept-encoding": "identity" };
  if (options.range) {
    headers.range = `bytes=${options.range.start}-${options.range.end ?? ""}`;
  }
  let response: Response;
  try {
    response = await http.request(url, {
      headers,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
  } catch (error) {
    throw toDownloadError(error, url);
  }
  const contentLength = contentLengthOf(response);
  const partial = response.status === 206;
  if (onOverflow === "throw" && contentLength !== undefined && contentLength > options.maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new PayloadTooLargeError(
      `The file is ${contentLength} bytes, above the ${options.maxBytes}-byte in-process cap`,
      {
        details: { url, contentLength, maxBytes: options.maxBytes },
        hint: "Use the Tabular API or Parquet access path, or preview_resource (bounded), or the download URL directly.",
      },
    );
  }
  const read = await readStream(response, options.maxBytes, onOverflow);
  let bytes = read.bytes;
  let truncated = read.truncated;
  let compression: DownloadResult["compression"];
  const looksGzip = sniffBytes(bytes.subarray(0, 4)).kind === "gzip";
  if (looksGzip && (options.decompress ?? true) && !options.range) {
    compression = "gzip";
    const inflated = await gunzipBounded(bytes, options.maxBytes, onOverflow);
    bytes = inflated.bytes;
    truncated = truncated || inflated.truncated;
  } else if (looksGzip) {
    compression = "gzip";
  }
  return {
    bytes,
    finalUrl: response.url || url,
    status: response.status,
    contentType: header(response, "content-type"),
    contentLength,
    compression,
    truncated,
    partial,
  };
}

/** First `bytes` of a URL for sniffing (range request, tolerant of servers ignoring Range). */
export async function fetchHead(http: HttpClient, url: string, bytes = 512): Promise<Uint8Array> {
  const result = await downloadBounded(http, url, {
    maxBytes: bytes,
    onOverflow: "truncate",
    decompress: false,
    range: { start: 0, end: bytes - 1 },
    timeoutMs: 8_000,
  });
  return result.bytes;
}

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * Decode bytes to text: UTF-8 (BOM-aware, strict) first, then chardet-driven
 * fallback (windows-1252 / ISO-8859-1 are common for French administrative CSVs).
 */
export function decodeText(input: Uint8Array, declaredCharset?: string): DecodedText {
  const bom = input.length >= 3 && UTF8_BOM.every((b, i) => input[i] === b);
  const bytes = bom ? input.subarray(3) : input;
  if (bom) return { text: new TextDecoder("utf-8").decode(bytes), encoding: "utf-8", bom };
  const declared = declaredCharset?.trim().toLowerCase();
  if (declared && declared !== "utf-8" && declared !== "utf8" && iconv.encodingExists(declared)) {
    return { text: iconv.decode(Buffer.from(bytes), declared), encoding: declared, bom };
  }
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
      bom,
    };
  } catch {
    const guess = detectEncoding(bytes.subarray(0, 64 * 1024))?.toLowerCase();
    const encoding =
      guess && guess !== "utf-8" && iconv.encodingExists(guess) ? guess : "windows-1252";
    return { text: iconv.decode(Buffer.from(bytes), encoding), encoding, bom };
  }
}

/** Charset from a `content-type` header, if any. */
export function charsetOf(contentType: string | undefined): string | undefined {
  const match = contentType ? /charset=([\w-]+)/i.exec(contentType) : null;
  return match?.[1];
}
