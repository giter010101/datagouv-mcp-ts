import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PayloadTooLargeError, ResourceUnavailableError } from "../../../src/core/errors.js";
import {
  decodeText,
  downloadBounded,
  fetchHead,
  gunzipBounded,
  probeUrl,
} from "../../../src/formats/download.js";
import { fakeFetch, testHttp } from "./helpers.js";

const csv = "a;b\n1;2\n";

describe("downloadBounded", () => {
  it("downloads, gunzips, and respects byte caps", async () => {
    const gz = gzipSync(Buffer.from(csv));
    const { fetch } = fakeFetch({ "https://example.org/f.csv.gz": new Uint8Array(gz) });
    const http = testHttp(fetch);
    const result = await downloadBounded(http, "https://example.org/f.csv.gz", {
      maxBytes: 10_000,
    });
    expect(result.compression).toBe("gzip");
    expect(new TextDecoder().decode(result.bytes)).toBe(csv);
  });

  it("throws PayloadTooLargeError when over cap (throw mode)", async () => {
    const body = "x".repeat(1000);
    const { fetch } = fakeFetch({ "https://example.org/big": body });
    await expect(
      downloadBounded(testHttp(fetch), "https://example.org/big", { maxBytes: 50 }),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("truncates when onOverflow is truncate", async () => {
    const body = "x".repeat(1000);
    const { fetch } = fakeFetch({ "https://example.org/big": body });
    const result = await downloadBounded(testHttp(fetch), "https://example.org/big", {
      maxBytes: 50,
      onOverflow: "truncate",
    });
    expect(result.truncated).toBe(true);
    expect(result.bytes.byteLength).toBe(50);
  });

  it("maps 404 to ResourceUnavailableError", async () => {
    const { fetch } = fakeFetch({});
    await expect(
      downloadBounded(testHttp(fetch), "https://example.org/missing", { maxBytes: 10 }),
    ).rejects.toBeInstanceOf(ResourceUnavailableError);
  });

  it("fetchHead uses a range request", async () => {
    const { fetch, calls } = fakeFetch({ "https://example.org/f": csv });
    const head = await fetchHead(testHttp(fetch), "https://example.org/f", 8);
    expect(head.byteLength).toBeLessThanOrEqual(8);
    expect(calls[0]?.headers.range).toMatch(/^bytes=0-/);
  });

  it("probeUrl returns content-length from HEAD", async () => {
    const { fetch } = fakeFetch({ "https://example.org/f": csv });
    const probe = await probeUrl(testHttp(fetch), "https://example.org/f");
    expect(probe.ok).toBe(true);
    expect(probe.contentLength).toBe(csv.length);
  });
});

describe("gunzipBounded / decodeText", () => {
  it("inflates gzip and truncates inflated output", async () => {
    const gz = gzipSync(Buffer.from("hello-world-payload"));
    const full = await gunzipBounded(new Uint8Array(gz), 1000, "throw");
    expect(new TextDecoder().decode(full.bytes)).toBe("hello-world-payload");
    const cut = await gunzipBounded(new Uint8Array(gz), 5, "truncate");
    expect(cut.truncated).toBe(true);
    expect(cut.bytes.byteLength).toBe(5);
  });

  it("decodes UTF-8 BOM and windows-1252 fallback", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("café")]);
    expect(decodeText(bom)).toMatchObject({ encoding: "utf-8", bom: true, text: "café" });
    const latin = decodeText(new Uint8Array([0xe9]), "windows-1252");
    expect(latin.text).toBe("é");
  });
});
