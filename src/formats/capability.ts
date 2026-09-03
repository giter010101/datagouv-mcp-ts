import type { ResourceDetail } from "../core/types.js";
import {
  API_FORMATS,
  ARCHIVE_FORMATS,
  DOCUMENT_FORMATS,
  familyOf,
  formatFromMime,
  formatFromUrl,
  IMAGE_FORMATS,
  JSON_FORMATS,
  normalizeFormat,
  SPREADSHEET_FORMATS,
  TABULAR_FILE_FORMATS,
  XML_FORMATS,
} from "./format-names.js";
import { type SniffResult, sniffBytes, sniffedKindToFormat } from "./sniff.js";
import type {
  AccessStrategy,
  CapabilityDetector,
  CapabilityDetectorDeps,
  CapabilityReport,
  DetectionConfidence,
  DetectOptions,
  ResourceCapability,
} from "./types.js";

/**
 * Capability detection (exec-plan §5, research/03 §7). Pure decision from
 * metadata, optionally refined by a Tabular API probe and by sniffing the first
 * bytes of the file. Never throws: probes that fail become warnings.
 */

export interface NormalizedFormat {
  format: string | undefined;
  compression: "gzip" | undefined;
  /** Where the format came from (for `reasons`). */
  source: "format" | "mime" | "detected-mime" | "url" | "none";
}

export function normalizeResourceFormat(resource: ResourceDetail): NormalizedFormat {
  const candidates: Array<[string | undefined, NormalizedFormat["source"]]> = [
    [normalizeFormat(resource.format), "format"],
    [formatFromMime(resource.mime), "mime"],
    [formatFromUrl(resource.url), "url"],
    [formatFromMime(resource.analysis.detectedMime), "detected-mime"],
  ];
  for (const [value, source] of candidates) {
    if (!value) continue;
    // Generic containers/mime types are only useful when nothing better exists.
    if ((value === "gzip" || value === "url") && source !== "format") continue;
    if (value === "csv.gz") return { format: "csv", compression: "gzip", source };
    if (value === "gzip") {
      const inner = formatFromUrl(resource.url.replace(/\.gz(\?.*)?$/i, ""));
      return { format: inner ?? "gzip", compression: "gzip", source };
    }
    return { format: value, compression: undefined, source };
  }
  return { format: undefined, compression: undefined, source: "none" };
}

interface Decision {
  primary: ResourceCapability;
  strategy: AccessStrategy;
  fallbacks: ResourceCapability[];
  confidence: DetectionConfidence;
}

function decideFromFormat(format: string | undefined): Decision {
  if (!format) {
    return {
      primary: "metadata_only",
      strategy: "metadata-only",
      fallbacks: [],
      confidence: "low",
    };
  }
  if (TABULAR_FILE_FORMATS.has(format) || format === "txt") {
    return { primary: "stream_parse", strategy: "stream-csv", fallbacks: [], confidence: "high" };
  }
  if (SPREADSHEET_FORMATS.has(format)) {
    return { primary: "stream_parse", strategy: "spreadsheet", fallbacks: [], confidence: "high" };
  }
  if (format === "parquet") {
    return { primary: "parquet", strategy: "parquet", fallbacks: [], confidence: "high" };
  }
  if (format === "geojson" || format === "topojson") {
    return { primary: "geo_preview", strategy: "geojson", fallbacks: [], confidence: "high" };
  }
  if (format === "kml" || format === "gpx" || XML_FORMATS.has(format)) {
    return { primary: "stream_parse", strategy: "xml", fallbacks: [], confidence: "medium" };
  }
  if (JSON_FORMATS.has(format)) {
    return { primary: "stream_parse", strategy: "json", fallbacks: [], confidence: "high" };
  }
  if (format === "shp") {
    return { primary: "archive_inspect", strategy: "shapefile", fallbacks: [], confidence: "high" };
  }
  if (format === "zip" || format === "kmz") {
    return {
      primary: "archive_inspect",
      strategy: "archive",
      fallbacks: [],
      confidence: format === "zip" ? "medium" : "high",
    };
  }
  if (ARCHIVE_FORMATS.has(format)) {
    // 7z / tar.gz / gpkg / dbf / mapinfo: no in-process reader → explain + link.
    return {
      primary: "archive_inspect",
      strategy: "metadata-only",
      fallbacks: ["metadata_only"],
      confidence: "high",
    };
  }
  if (DOCUMENT_FORMATS.has(format)) {
    return {
      primary: "document_preview",
      strategy: "document",
      fallbacks: ["metadata_only"],
      confidence: "high",
    };
  }
  if (IMAGE_FORMATS.has(format)) {
    return {
      primary: "metadata_only",
      strategy: "metadata-only",
      fallbacks: [],
      confidence: "high",
    };
  }
  if (API_FORMATS.has(format)) {
    return {
      primary: "api_endpoint",
      strategy: "api-endpoint",
      fallbacks: ["metadata_only"],
      confidence: "high",
    };
  }
  return { primary: "metadata_only", strategy: "metadata-only", fallbacks: [], confidence: "low" };
}

const HYDRA_TABULAR_FORMATS: ReadonlySet<string> = new Set(["csv", "tsv", "xlsx", "xls", "ods"]);

function tabularApiUrl(base: string, resourceId: string): string {
  return `${base.replace(/\/+$/, "")}/api/resources/${resourceId}/`;
}

function applySniff(
  current: NormalizedFormat,
  sniff: SniffResult,
  warnings: string[],
  reasons: string[],
): NormalizedFormat {
  const sniffed = sniffedKindToFormat(sniff);
  if (!sniffed || sniff.kind === "text" || sniff.kind === "empty") {
    if (!current.format && sniffed) {
      reasons.push(`content sniffing suggests ${sniffed}`);
      return { format: sniffed, compression: current.compression, source: "none" };
    }
    if (sniff.kind === "empty") warnings.push("The file is empty (0 bytes).");
    return current;
  }
  const declared = current.format;
  if (sniffed === "gzip") {
    if (current.compression !== "gzip") reasons.push("content sniffing: gzip magic number");
    return { ...current, compression: "gzip" };
  }
  if (!declared) {
    reasons.push(`content sniffing detected ${sniffed}`);
    return { format: sniffed, compression: undefined, source: "none" };
  }
  const compatible =
    declared === sniffed ||
    (sniffed === "zip" && (SPREADSHEET_FORMATS.has(declared) || declared === "shp")) ||
    (sniffed === "xls" && SPREADSHEET_FORMATS.has(declared)) ||
    (sniffed === "json" && (declared === "geojson" || declared === "topojson")) ||
    (sniffed === "xml" && (declared === "kml" || declared === "gml" || declared === "gpx")) ||
    (sniffed === "json" && declared === "jsonl") ||
    (sniffed === "jsonl" && declared === "json") ||
    ((sniffed === "csv" || sniffed === "tsv") && (declared === "txt" || declared === "tsv"));
  if (compatible) return current;
  if (sniffed === "html") {
    warnings.push(
      `Declared format is "${declared}" but the URL serves an HTML page (probably a landing or error page, not a data file).`,
    );
    return { format: "html", compression: undefined, source: "none" };
  }
  warnings.push(`Declared format is "${declared}" but the content looks like ${sniffed}.`);
  return { format: sniffed, compression: undefined, source: "none" };
}

async function trySniff(
  deps: CapabilityDetectorDeps,
  url: string,
  bytes: number,
  warnings: string[],
): Promise<SniffResult | undefined> {
  if (!deps.sniffHead) return undefined;
  try {
    return sniffBytes(await deps.sniffHead(url, bytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Could not read the first bytes of the file: ${message}`);
    return undefined;
  }
}

export function createCapabilityDetector(deps: CapabilityDetectorDeps): CapabilityDetector {
  return (resource, options) => detectCapability(resource, deps, options);
}

export async function detectCapability(
  resource: ResourceDetail,
  deps: CapabilityDetectorDeps,
  options: DetectOptions = {},
): Promise<CapabilityReport> {
  const offline = options.offline ?? false;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const a = resource.analysis;
  let normalized = normalizeResourceFormat(resource);
  if (normalized.format) reasons.push(`format "${normalized.format}" from ${normalized.source}`);
  else reasons.push("no usable format in metadata (format, mime, url)");

  const sizeBytes = resource.filesize ?? a.contentLength;
  const declaredMime = resource.mime?.toLowerCase();
  const detectedMime = a.detectedMime?.toLowerCase();
  if (
    detectedMime &&
    declaredMime &&
    detectedMime !== declaredMime &&
    (detectedMime.includes("html") || detectedMime.includes("javascript"))
  ) {
    warnings.push(
      `Declared mime "${declaredMime}" but Hydra detected "${detectedMime}": the URL may serve a web page instead of data.`,
    );
  }

  let tabularProbe: CapabilityReport["tabularProbe"] = "skipped";
  let decision: Decision;

  const dead = a.checkAvailable === false || (a.checkStatus !== undefined && a.checkStatus >= 400);
  const isApi =
    resource.type === "api" ||
    (normalized.format !== undefined && API_FORMATS.has(normalized.format)) ||
    a.ogcMetadata !== undefined;
  const isDocumentation =
    resource.type === "documentation" &&
    (normalized.format === undefined || !HYDRA_TABULAR_FORMATS.has(normalized.format));

  if (dead) {
    reasons.push(
      `Hydra link check: available=${a.checkAvailable ?? "?"} status=${a.checkStatus ?? "?"}`,
    );
    warnings.push(
      `Dead link: the URL was unavailable at the last check${a.checkDate ? ` (${a.checkDate})` : ""}${
        a.checkStatus !== undefined ? `, HTTP ${a.checkStatus}` : ""
      }${a.checkError ? `: ${a.checkError}` : ""}.`,
    );
    decision = {
      primary: "dead_link",
      strategy: "metadata-only",
      fallbacks: ["metadata_only"],
      confidence: "high",
    };
  } else if (isApi) {
    reasons.push(resource.type === "api" ? 'type is "api"' : "format is an API/OGC service");
    decision = {
      primary: "api_endpoint",
      strategy: "api-endpoint",
      fallbacks: ["metadata_only"],
      confidence: "high",
    };
  } else if (isDocumentation) {
    reasons.push('type is "documentation"');
    decision = decideFromFormat(normalized.format);
    if (decision.strategy !== "document") {
      decision = {
        primary: "document_preview",
        strategy: decision.strategy === "metadata-only" ? "metadata-only" : decision.strategy,
        fallbacks: ["metadata_only"],
        confidence: "medium",
      };
    }
  } else {
    if (!offline) {
      const needsSniff =
        normalized.format === undefined ||
        resource.filetype === "remote" ||
        TABULAR_FILE_FORMATS.has(normalized.format) ||
        JSON_FORMATS.has(normalized.format) ||
        normalized.format === "zip";
      if (needsSniff && !a.parsingTable) {
        const sniff = await trySniff(deps, resource.url, options.sniffBytes ?? 512, warnings);
        if (sniff) normalized = applySniff(normalized, sniff, warnings, reasons);
      }
    }
    decision = decideFromFormat(normalized.format);
    if (a.geojsonUrl && decision.strategy !== "geojson") {
      reasons.push("Hydra GeoJSON conversion available (analysis:parsing:geojson_url)");
      decision = {
        primary: "geo_preview",
        strategy: "geojson",
        fallbacks: [decision.primary, ...decision.fallbacks],
        confidence: "high",
      };
    }

    const format = normalized.format;
    const mayBeTabular =
      a.parsingTable !== undefined || (format !== undefined && HYDRA_TABULAR_FORMATS.has(format));
    if (mayBeTabular && deps.probeTabular && !offline) {
      try {
        const schema = await deps.probeTabular(resource.id);
        tabularProbe = schema ? "available" : "unavailable";
      } catch (error) {
        tabularProbe = "error";
        warnings.push(
          `Tabular API probe failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const tabularConfirmed =
      tabularProbe === "available" ||
      (a.parsingTable !== undefined && tabularProbe !== "unavailable");
    if (tabularConfirmed) {
      reasons.push(
        tabularProbe === "available"
          ? "Tabular API /profile/ responded"
          : "extras analysis:parsing:parsing_table present",
      );
      let primary: ResourceCapability = "tabular_api";
      if (deps.crawlerExceptions) {
        try {
          if ((await deps.crawlerExceptions()).has(resource.id)) {
            primary = "tabular_api_large";
            warnings.push(
              "Very large resource (crawler size exception): paginate and filter server-side.",
            );
          }
        } catch {
          /* stale/unavailable exceptions list is not a failure */
        }
      }
      decision = {
        primary,
        strategy: "tabular-api",
        fallbacks: [...(a.parquetUrl ? ["parquet" as const] : []), decision.primary],
        confidence: "high",
      };
    } else if (a.parquetUrl && (mayBeTabular || format === undefined)) {
      reasons.push("Hydra Parquet conversion available (analysis:parsing:parquet_url)");
      decision = {
        primary: "parquet",
        strategy: "hydra-parquet",
        fallbacks: [decision.primary],
        confidence: "high",
      };
    }
    if (
      decision.primary === "metadata_only" &&
      resource.filetype === "remote" &&
      normalized.format === undefined
    ) {
      decision = {
        primary: "remote_caution",
        strategy: "metadata-only",
        fallbacks: ["metadata_only"],
        confidence: "low",
      };
      reasons.push("remote resource with unknown content type");
    }
  }

  if (
    sizeBytes !== undefined &&
    deps.maxDownloadBytes !== undefined &&
    sizeBytes > deps.maxDownloadBytes &&
    (decision.primary === "stream_parse" ||
      decision.primary === "geo_preview" ||
      decision.primary === "archive_inspect")
  ) {
    warnings.push(
      `File is ${Math.round(sizeBytes / 1_048_576)} MB, above the in-process cap (${Math.round(
        deps.maxDownloadBytes / 1_048_576,
      )} MB): only the first bytes can be previewed; prefer the Tabular API / Parquet path or the download URL.`,
    );
  }
  if (a.analysisError) warnings.push(`Hydra analysis error: ${a.analysisError}`);

  const capabilities = dedupe<ResourceCapability>([
    decision.primary,
    ...decision.fallbacks,
    "metadata_only",
  ]);
  const detectedFormat = normalized.format ?? "";
  return {
    resourceId: resource.id,
    primary: decision.primary,
    capabilities,
    strategy: decision.strategy,
    confidence: decision.confidence,
    formatFamily: familyOf(normalized.format),
    detectedFormat,
    compression: normalized.compression,
    reasons,
    urls: {
      download: resource.url,
      latest: resource.latestUrl,
      parquet: a.parquetUrl,
      geojson: a.geojsonUrl,
      preview: resource.previewUrl,
      tabularApi:
        decision.strategy === "tabular-api" || a.parsingTable
          ? tabularApiUrl(deps.tabularApiBaseUrl, resource.id)
          : undefined,
    },
    sizeBytes,
    tabularProbe,
    warnings,
  };
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}
