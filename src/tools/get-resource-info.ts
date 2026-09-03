import { z } from "zod";
import type { ResourceDetail } from "../core/types.js";
import type { CapabilityReport } from "../formats/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { renderReport, toStructuredReport } from "./shared/capability-hints.js";
import { humanSize, kv, lines } from "./shared/formatters.js";
import { capabilityReportSchema } from "./shared/output-schemas.js";
import { openResource } from "./shared/resource-access.js";
import { defineTool } from "./types.js";

export const getResourceInfoInputShape = {
  resource_id: z.string().min(1).describe("Resource UUID (from list_dataset_resources)."),
};

export const resourceDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  format: z.string(),
  mime: z.string().optional(),
  type: z.string(),
  filetype: z.string(),
  filesize: z.number().optional(),
  size_human: z.string().optional(),
  url: z.string(),
  latest_url: z.string(),
  preview_url: z.string().optional(),
  created_at: z.string().optional(),
  last_modified: z.string().optional(),
  dataset_id: z.string(),
  dataset_title: z.string().optional(),
  checksum: z.object({ type: z.string(), value: z.string() }).optional(),
  schema: z
    .object({ name: z.string(), version: z.string().optional(), url: z.string().optional() })
    .optional(),
  analysis: z.record(z.string(), z.unknown()),
});

export const getResourceInfoOutputShape = {
  resource: resourceDetailSchema,
  tabular_api: z.object({
    available: z.boolean(),
    large_file_exception: z.boolean(),
    status_line: z.string().describe("Legacy status line (✅/⚠️)."),
  }),
  capability: capabilityReportSchema,
};

export const getResourceInfoTool = defineTool<typeof getResourceInfoInputShape, ToolDeps>({
  name: "get_resource_info",
  title: "Get resource info",
  legacy: true,
  description: [
    "Get detailed information about a specific resource (file).",
    "",
    "Returns format, size, MIME type, URL, and checks Tabular API availability.",
    "Helps decide whether to use query_resource_data (if Tabular API is available)",
    "or fetch the raw file URL directly for unsupported formats or large files.",
    "",
    "Also returns a full capability report: the detected format family, every applicable access",
    "path (tabular_api, parquet, stream_parse, geo_preview, archive_inspect, document_preview,",
    "api_endpoint, dead_link…), the platform's link-check result, and the recommended next tool",
    "(query_resource, preview_resource, get_resource_schema…).",
  ].join("\n"),
  inputSchema: getResourceInfoInputShape,
  outputSchema: getResourceInfoOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const { resource, report } = await openResource(ctx.deps, input.resource_id, {
      signal: ctx.signal,
    });
    let datasetTitle: string | undefined;
    if (resource.datasetId) {
      try {
        datasetTitle = (await ctx.deps.datagouv.getDataset(resource.datasetId)).title;
      } catch {
        // legacy: dataset title is best-effort
      }
    }
    const tabular = tabularStatus(report);
    const text = lines(
      `Resource Information: ${resource.title || "Unknown"}`,
      "",
      `Resource ID: ${resource.id}`,
      kv("Format", resource.format),
      resource.filesize ? `Size: ${humanSize(resource.filesize)}` : undefined,
      kv("MIME type", resource.mime),
      kv("Type", resource.type),
      kv("File type", resource.filetype),
      kv("Last modified", resource.lastModified),
      "",
      kv("URL", resource.url),
      kv("Stable URL", resource.latestUrl),
      resource.description ? "" : undefined,
      resource.description ? `Description: ${resource.description}` : undefined,
      resource.datasetId ? "" : undefined,
      kv("Dataset ID", resource.datasetId),
      kv("Dataset", datasetTitle),
      "",
      "Tabular API availability:",
      tabular.statusLine,
      "",
      ...renderReport(report),
    );
    return {
      text,
      structured: {
        resource: resourceDetailToStructured(resource, datasetTitle),
        tabular_api: {
          available: tabular.available,
          large_file_exception: tabular.largeFileException,
          status_line: tabular.statusLine,
        },
        capability: toStructuredReport(report),
      },
    };
  },
});

/** Legacy status lines (research/01 §2.5) derived from the capability report. */
export function tabularStatus(report: CapabilityReport) {
  const available = report.capabilities.some(
    (c) => c === "tabular_api" || c === "tabular_api_large",
  );
  const largeFileException = report.capabilities.includes("tabular_api_large");
  let statusLine: string;
  if (available && largeFileException) statusLine = "✅ Available via Tabular API (large file exception)";
  else if (available) statusLine = "✅ Available via Tabular API (can be queried)";
  else if (report.tabularProbe === "error") statusLine = "⚠️  Could not check Tabular API availability";
  else statusLine = "⚠️  Not available via Tabular API (may not be tabular data)";
  return { available, largeFileException, statusLine };
}

export function resourceDetailToStructured(r: ResourceDetail, datasetTitle?: string) {
  const analysis = Object.fromEntries(
    Object.entries(r.analysis).filter(([, v]) => v !== undefined),
  );
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    format: r.format,
    mime: r.mime,
    type: r.type,
    filetype: r.filetype,
    filesize: r.filesize,
    size_human: r.filesize ? humanSize(r.filesize) : undefined,
    url: r.url,
    latest_url: r.latestUrl,
    preview_url: r.previewUrl,
    created_at: r.createdAt,
    last_modified: r.lastModified,
    dataset_id: r.datasetId,
    dataset_title: datasetTitle,
    checksum: r.checksum,
    schema: r.schema,
    analysis,
  };
}
