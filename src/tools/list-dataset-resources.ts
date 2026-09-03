import { z } from "zod";
import type { DatasetDetail, ResourceDetail, ResourceSummary } from "../core/types.js";
import type { CapabilityReport } from "../formats/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { accessHint, recommendationFor } from "./shared/capability-hints.js";
import { humanSize } from "./shared/formatters.js";
import { pageOutputShape, resourceSummarySchema } from "./shared/output-schemas.js";
import { getDatasetOrThrow } from "./shared/resource-access.js";
import { defineTool } from "./types.js";

/** Legacy returned every resource; keep that by default (≤ 200) and paginate beyond. */
export const RESOURCES_PAGE_SIZE_MAX = 200;

export const listDatasetResourcesInputShape = {
  dataset_id: z.string().min(1).describe("Dataset ID (24-hex) or slug."),
  page: z.number().int().min(1).default(1).describe("Page of resources (only needed for datasets with more than 200 files)."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(RESOURCES_PAGE_SIZE_MAX)
    .default(RESOURCES_PAGE_SIZE_MAX)
    .describe("Resources per page (default and max 200)."),
};

export const listDatasetResourcesOutputShape = {
  dataset_id: z.string(),
  dataset_title: z.string(),
  ...pageOutputShape,
  resources: z.array(resourceSummarySchema),
};

export const listDatasetResourcesTool = defineTool<typeof listDatasetResourcesInputShape, ToolDeps>({
  name: "list_dataset_resources",
  title: "List dataset resources",
  legacy: true,
  description: [
    "List all resources (files) in a dataset with their metadata.",
    "",
    "Returns resource ID, title, format, size, and URL for each file, plus an `access_hint`",
    "computed offline from the metadata (which capability applies and which tool to call next).",
    "Next step: use query_resource / query_resource_data for tables served by the Tabular API,",
    "preview_resource for any other format (JSON, GeoJSON, Parquet, PDF, archives…), or",
    "get_resource_info for the full capability report of one resource.",
    "For a ranked overview with a recommended starting resource, prefer get_dataset_resources_summary.",
  ].join("\n"),
  inputSchema: listDatasetResourcesInputShape,
  outputSchema: listDatasetResourcesOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const dataset = await getDatasetOrThrow(ctx.deps, input.dataset_id);
    const all = dataset.resources.filter((r) => r.id);
    const start = (input.page - 1) * input.page_size;
    const slice = all.slice(start, start + input.page_size);
    const hasNext = start + slice.length < all.length;

    const reports = await Promise.all(
      slice.map((r) => detectOffline(ctx.deps, dataset, r).catch(() => undefined)),
    );

    const lines = [
      `Resources in dataset: ${dataset.title || "Unknown"}`,
      `Dataset ID: ${input.dataset_id}`,
      `Total resources: ${all.length}`,
      "",
    ];
    if (all.length === 0) {
      lines.push("This dataset has no resources.");
    }
    slice.forEach((resource, index) => {
      const report = reports[index];
      lines.push(`${start + index + 1}. ${resource.title || "Untitled"}`);
      lines.push(`   Resource ID: ${resource.id}`);
      if (resource.format) lines.push(`   Format: ${resource.format}`);
      if (resource.filesize) lines.push(`   Size: ${humanSize(resource.filesize)}`);
      if (resource.mime) lines.push(`   MIME type: ${resource.mime}`);
      if (resource.type) lines.push(`   Type: ${resource.type}`);
      if (resource.url) lines.push(`   URL: ${resource.url}`);
      if (report) lines.push(`   Access: ${accessHint(report)}`);
      lines.push("");
    });
    if (hasNext) lines.push(`More resources available: use page=${input.page + 1}.`);

    return {
      text: lines.join("\n").trimEnd(),
      structured: {
        dataset_id: dataset.id,
        dataset_title: dataset.title,
        total: all.length,
        page: input.page,
        page_size: input.page_size,
        has_next: hasNext,
        resources: slice.map((r, i) => resourceSummaryToStructured(r, reports[i])),
      },
      howToGetMore: hasNext ? `Use page=${input.page + 1} for the next resources.` : undefined,
    };
  },
});

export function resourceSummaryToStructured(r: ResourceSummary, report?: CapabilityReport) {
  return {
    id: r.id,
    title: r.title,
    format: r.format,
    mime: r.mime,
    type: r.type,
    filetype: r.filetype,
    filesize: r.filesize,
    size_human: r.filesize ? humanSize(r.filesize) : undefined,
    url: r.url,
    latest_url: r.latestUrl,
    last_modified: r.lastModified,
    access_hint: report ? report.primary : undefined,
    recommended_tool: report ? recommendationFor(report.primary).tool : undefined,
  };
}

/** Build the `ResourceDetail` the detector expects from an embedded (v1) resource summary. */
export function summaryToDetail(dataset: DatasetDetail, r: ResourceSummary): ResourceDetail {
  return {
    ...r,
    datasetId: dataset.id,
    checksum: undefined,
    analysis: {
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
    },
    extras: {},
  };
}

export function detectOffline(deps: ToolDeps, dataset: DatasetDetail, r: ResourceSummary) {
  return deps.formats.detectCapability(summaryToDetail(dataset, r), { offline: true });
}
