import type { CapabilityReport, ResourceCapability } from "../../formats/types.js";

export interface AccessRecommendation {
  /** Tool the LLM should call next for this resource. */
  tool: string;
  /** One sentence explaining why / how. */
  hint: string;
}

const RECOMMENDATIONS: Record<ResourceCapability, AccessRecommendation> = {
  tabular_api: {
    tool: "query_resource",
    hint: "Rows are served by the Tabular API: filter, sort and paginate without downloading (query_resource or legacy query_resource_data).",
  },
  tabular_api_large: {
    tool: "query_resource",
    hint: "Very large table served by the Tabular API: always filter or paginate (page_size ≤ 200); never try to fetch everything.",
  },
  parquet: {
    tool: "query_resource",
    hint: "A Parquet file is available: get_resource_schema reads the footer cheaply, query_resource reads bounded slices.",
  },
  stream_parse: {
    tool: "preview_resource",
    hint: "The file will be downloaded (bounded) and parsed in-process: start with preview_resource, then query_resource for filters.",
  },
  geo_preview: {
    tool: "preview_resource",
    hint: "Geographic data: preview_resource returns feature count, bounding box and sample features.",
  },
  archive_inspect: {
    tool: "preview_resource",
    hint: "Archive (zip/shapefile/gpkg…): preview_resource lists entries and layer metadata; extraction is never automatic.",
  },
  document_preview: {
    tool: "preview_resource",
    hint: "Document (PDF/text/markdown…): preview_resource extracts a bounded excerpt.",
  },
  api_endpoint: {
    tool: "get_resource_info",
    hint: "This is an API/service endpoint, not a file: use the URL with the service's own protocol (WMS/WFS/REST).",
  },
  remote_caution: {
    tool: "check_resource_availability",
    hint: "External URL of unknown size/type: check_resource_availability probes it (HEAD) before any download.",
  },
  metadata_only: {
    tool: "get_resource_info",
    hint: "No data access path applies (image/unknown binary): only metadata and the download URL are available.",
  },
  dead_link: {
    tool: "list_dataset_resources",
    hint: "The link is reported dead by the platform's crawler: pick another resource of the dataset.",
  },
};

export function recommendationFor(capability: ResourceCapability): AccessRecommendation {
  return RECOMMENDATIONS[capability];
}

/** Short label used in list outputs (`list_dataset_resources`, summaries). */
export function accessHint(report: CapabilityReport): string {
  const rec = recommendationFor(report.primary);
  return `${report.primary} → ${rec.tool}`;
}

export function toStructuredReport(report: CapabilityReport) {
  const rec = recommendationFor(report.primary);
  return {
    primary: report.primary,
    capabilities: report.capabilities,
    format_family: report.formatFamily,
    detected_format: report.detectedFormat,
    size_bytes: report.sizeBytes,
    tabular_probe: report.tabularProbe,
    urls: {
      download: report.urls.download,
      latest: report.urls.latest,
      parquet: report.urls.parquet,
      geojson: report.urls.geojson,
      preview: report.urls.preview,
      tabular_api: report.urls.tabularApi,
    },
    reasons: report.reasons,
    warnings: report.warnings,
    recommended_tool: rec.tool,
    recommendation: rec.hint,
  };
}

export function renderReport(report: CapabilityReport): string[] {
  const rec = recommendationFor(report.primary);
  const out = [
    "Access capabilities:",
    `  Primary: ${report.primary} (format family: ${report.formatFamily}, detected format: ${report.detectedFormat || "unknown"})`,
    `  All: ${report.capabilities.join(", ")}`,
    `  Tabular API probe: ${report.tabularProbe}`,
    `  Recommended next tool: ${rec.tool} — ${rec.hint}`,
  ];
  if (report.urls.parquet) out.push(`  Parquet URL: ${report.urls.parquet}`);
  if (report.urls.geojson) out.push(`  GeoJSON URL: ${report.urls.geojson}`);
  if (report.urls.tabularApi) out.push(`  Tabular API URL: ${report.urls.tabularApi}`);
  for (const warning of report.warnings) out.push(`Warning: ${warning}`);
  return out;
}
