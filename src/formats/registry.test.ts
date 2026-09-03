import { describe, expect, it } from "vitest";
import { UnsupportedCapabilityError } from "../core/errors.js";
import type { ResourceDetail } from "../core/types.js";
import { createAccessorRegistry } from "./registry.js";
import type { AccessContext, CapabilityReport, ResourceAccessor } from "./types.js";

const resource = { id: "res-1" } as ResourceDetail;

function report(
  capabilities: CapabilityReport["capabilities"],
  detectedFormat = "csv",
): CapabilityReport {
  return {
    resourceId: "res-1",
    primary: capabilities[0] ?? "metadata_only",
    capabilities,
    formatFamily: "tabular",
    detectedFormat,
    reasons: [],
    urls: {
      download: "https://example.org/f.csv",
      latest: "https://example.org/f.csv",
      parquet: undefined,
      geojson: undefined,
      preview: undefined,
      tabularApi: undefined,
    },
    sizeBytes: undefined,
    tabularProbe: "skipped",
    warnings: [],
  };
}

function accessor(
  id: string,
  capabilities: ResourceAccessor["capabilities"],
  formats?: string[],
): ResourceAccessor {
  return {
    id,
    capabilities,
    supports: (ctx) => (formats ? formats.includes(ctx.report.detectedFormat) : true),
    getSchema: async () => undefined,
    preview: async () => ({ kind: "metadata", facts: {}, notes: [] }),
  };
}

describe("AccessorRegistry", () => {
  it("resolves the first accessor for the best capability", () => {
    const registry = createAccessorRegistry([
      accessor("csv-stream", ["stream_parse"], ["csv"]),
      accessor("tabular-api", ["tabular_api", "tabular_api_large"]),
    ]);
    const ctx: AccessContext = {
      resource,
      report: report(["tabular_api", "stream_parse"]),
      maxDownloadBytes: 1,
    };
    expect(registry.resolve(ctx).id).toBe("tabular-api");
  });

  it("falls through to the next capability when supports() rejects", () => {
    const registry = createAccessorRegistry([
      accessor("csv-stream", ["stream_parse"], ["csv"]),
      accessor("xlsx-stream", ["stream_parse"], ["xlsx"]),
    ]);
    const ctx: AccessContext = {
      resource,
      report: report(["stream_parse"], "xlsx"),
      maxDownloadBytes: 1,
    };
    expect(registry.resolve(ctx).id).toBe("xlsx-stream");
  });

  it("throws UnsupportedCapabilityError with a hint when nothing applies", () => {
    const registry = createAccessorRegistry();
    const ctx: AccessContext = {
      resource,
      report: report(["metadata_only"], "pdf"),
      maxDownloadBytes: 1,
    };
    expect(registry.tryResolve(ctx)).toBeUndefined();
    expect(() => registry.resolve(ctx)).toThrow(UnsupportedCapabilityError);
  });

  it("rejects duplicate accessor ids", () => {
    const registry = createAccessorRegistry([accessor("a", ["parquet"])]);
    expect(() => registry.register(accessor("a", ["parquet"]))).toThrow(/already registered/);
  });
});
