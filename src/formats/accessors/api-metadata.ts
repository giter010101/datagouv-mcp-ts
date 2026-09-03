import type { ResourceAccessor } from "../types.js";
import { metadataPreview, unsupportedQuery } from "./shared.js";

function capabilitiesUrl(serviceUrl: string, service: "WMS" | "WFS" | "WMTS"): string {
  const joiner = serviceUrl.includes("?") ? "&" : "?";
  return `${serviceUrl}${joiner}SERVICE=${service}&REQUEST=GetCapabilities`;
}

function guessedService(format: string, url: string): "WMS" | "WFS" | "WMTS" | undefined {
  const hay = `${format} ${url}`.toLowerCase();
  if (hay.includes("wmts")) return "WMTS";
  if (hay.includes("wfs")) return "WFS";
  if (hay.includes("wms")) return "WMS";
  return undefined;
}

/**
 * WMS / WFS / OGC / ArcGIS / `type=api`: return the service URL and a
 * GetCapabilities link. Never fetches the endpoint body.
 */
export function createApiEndpointAccessor(): ResourceAccessor {
  return {
    id: "api-endpoint",
    capabilities: ["api_endpoint"],
    supports: (ctx) =>
      ctx.report.strategy === "api-endpoint" || ctx.report.primary === "api_endpoint",
    async getSchema() {
      return undefined;
    },
    async preview(ctx) {
      const url = ctx.resource.url;
      const format = ctx.report.detectedFormat || ctx.resource.format;
      const service = guessedService(format, url);
      const ogc = ctx.resource.analysis.ogcMetadata;
      const facts: Record<string, unknown> = {
        serviceUrl: url,
        format,
        type: ctx.resource.type,
        ogcMetadata: ogc,
      };
      if (service) facts.capabilitiesUrl = capabilitiesUrl(url, service);
      return metadataPreview(ctx, facts, [
        "This resource is an API / OGC service, not a downloadable table. Do not fetch the endpoint blindly.",
        service
          ? `Inspect ${service} capabilities at the capabilitiesUrl, or use get_dataservice_info when a dataservice is linked.`
          : "Use the service URL with the publisher's documentation; OpenAPI may be available via get_dataservice_openapi_spec.",
      ]);
    },
    query(ctx) {
      return unsupportedQuery(ctx, "api-endpoint");
    },
  };
}

/**
 * Last-resort accessor: always applies, never throws. Images, unknown binaries,
 * dead links, remote_caution, 7z/gpkg without a reader.
 */
export function createMetadataAccessor(): ResourceAccessor {
  return {
    id: "metadata-only",
    capabilities: [
      "metadata_only",
      "remote_caution",
      "dead_link",
      "archive_inspect",
      "document_preview",
    ],
    supports: () => true,
    async getSchema() {
      return undefined;
    },
    async preview(ctx) {
      const notes: string[] = [...ctx.report.warnings];
      if (ctx.report.primary === "dead_link") {
        notes.push("The last Hydra check reported this URL as unavailable.");
      } else if (ctx.report.primary === "remote_caution") {
        notes.push(
          "Remote URL with unknown content: only metadata is returned; pass a format-specific resource to preview data.",
        );
      } else {
        notes.push("No in-process reader for this format; use the download / latest URL.");
      }
      return metadataPreview(
        ctx,
        {
          primary: ctx.report.primary,
          strategy: ctx.report.strategy,
          checkAvailable: ctx.resource.analysis.checkAvailable,
          checkStatus: ctx.resource.analysis.checkStatus,
          parquetUrl: ctx.report.urls.parquet,
          geojsonUrl: ctx.report.urls.geojson,
        },
        notes,
      );
    },
    query(ctx) {
      return unsupportedQuery(ctx, "metadata-only");
    },
  };
}
