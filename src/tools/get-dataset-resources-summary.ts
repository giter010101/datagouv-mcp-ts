import { z } from "zod";
import { truncate } from "../core/text.js";
import type { ResourceSummary } from "../core/types.js";
import type { CapabilityReport, ResourceCapability } from "../formats/types.js";
import type { ToolDeps } from "./deps.js";
import { detectOffline, resourceSummaryToStructured } from "./list-dataset-resources.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { recommendationFor } from "./shared/capability-hints.js";
import { humanSize, LIST_DESCRIPTION_CHARS } from "./shared/formatters.js";
import { resourceSummarySchema } from "./shared/output-schemas.js";
import { getDatasetOrThrow } from "./shared/resource-access.js";
import { defineTool } from "./types.js";

/** Lower is better when picking the resource to start with. */
const CAPABILITY_RANK: Record<ResourceCapability, number> = {
  tabular_api: 0,
  parquet: 1,
  tabular_api_large: 2,
  stream_parse: 3,
  geo_preview: 4,
  archive_inspect: 5,
  document_preview: 6,
  api_endpoint: 7,
  remote_caution: 8,
  metadata_only: 9,
  dead_link: 10,
};

const MAX_LISTED = 200;

export const getDatasetResourcesSummaryInputShape = {
  dataset_id: z.string().min(1).describe("Dataset ID (24-hex) or slug."),
};

const groupSchema = z.object({
  family: z.string(),
  count: z.number().int(),
  formats: z.array(z.string()),
  total_bytes: z.number().optional(),
  resource_ids: z.array(z.string()),
});

export const getDatasetResourcesSummaryOutputShape = {
  dataset: z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description_short: z.string(),
    organization: z.string().optional(),
    url: z.string(),
    last_update: z.string().optional(),
    license: z.string().optional(),
    badges: z.array(z.string()),
    schema: z.object({ name: z.string(), version: z.string().optional(), url: z.string().optional() }).optional(),
  }),
  resources_total: z.number().int(),
  main_resources: z.number().int(),
  documentation_resources: z.number().int(),
  latest_modification: z.string().optional(),
  groups: z.array(groupSchema),
  recommended: z
    .object({
      resource_id: z.string(),
      title: z.string(),
      capability: z.string(),
      tool: z.string(),
      reason: z.string(),
    })
    .optional(),
  resources: z.array(resourceSummarySchema),
};

export const getDatasetResourcesSummaryTool = defineTool<
  typeof getDatasetResourcesSummaryInputShape,
  ToolDeps
>({
  name: "get_dataset_resources_summary",
  title: "Get dataset resources summary",
  description: [
    "One-call overview of a dataset and all its resources, with the best way to access each one.",
    "",
    "Returns the dataset headline (title, publisher, license, last update, badges, declared schema),",
    "resources grouped by format family (tabular, spreadsheet, json, geo, archive, document, api…)",
    "with sizes and freshness, each resource's capability tier and recommended tool, and a single",
    "`recommended` resource to start with (queryable main data preferred over documentation).",
    "Detection is offline (metadata only, no probes) so it is fast; confirm with get_resource_info",
    "before heavy queries. Cuts the search → list → info hop count: call it right after search_datasets.",
  ].join("\n"),
  inputSchema: getDatasetResourcesSummaryInputShape,
  outputSchema: getDatasetResourcesSummaryOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const dataset = await getDatasetOrThrow(ctx.deps, input.dataset_id);
    const resources = dataset.resources.filter((r) => r.id).slice(0, MAX_LISTED);
    const reports = await Promise.all(
      resources.map((r) => detectOffline(ctx.deps, dataset, r).catch(() => undefined)),
    );

    const groups = new Map<string, { formats: Set<string>; bytes: number; known: boolean; ids: string[] }>();
    let latest: string | undefined;
    let mainCount = 0;
    let docCount = 0;
    let best: { r: ResourceSummary; report: CapabilityReport; score: number } | undefined;

    resources.forEach((r, i) => {
      const report = reports[i];
      const family = report?.formatFamily ?? "unknown";
      const g = groups.get(family) ?? { formats: new Set<string>(), bytes: 0, known: false, ids: [] };
      g.formats.add(report?.detectedFormat || r.format || "unknown");
      if (r.filesize !== undefined) {
        g.bytes += r.filesize;
        g.known = true;
      }
      g.ids.push(r.id);
      groups.set(family, g);
      if (r.lastModified && (!latest || r.lastModified > latest)) latest = r.lastModified;
      if (r.type === "main") mainCount++;
      if (r.type === "documentation") docCount++;
      if (report) {
        const score = CAPABILITY_RANK[report.primary] * 10 + (r.type === "main" ? 0 : 5);
        if (!best || score < best.score) best = { r, report, score };
      }
    });

    const recommended = best
      ? {
          resource_id: best.r.id,
          title: best.r.title,
          capability: best.report.primary,
          tool: recommendationFor(best.report.primary).tool,
          reason: `${best.r.type === "main" ? "Main data resource" : `Resource of type '${best.r.type}'`} with the strongest access path (${best.report.primary}).`,
        }
      : undefined;

    const lines = [
      `Dataset: ${dataset.title || "Untitled"}`,
      `ID: ${dataset.id} (slug: ${dataset.slug})`,
      dataset.organization ? `Organization: ${dataset.organization.name}` : undefined,
      dataset.descriptionShort ? `Description: ${truncate(dataset.descriptionShort, LIST_DESCRIPTION_CHARS)}` : undefined,
      dataset.license ? `License: ${dataset.license}` : undefined,
      dataset.lastUpdate ? `Last update: ${dataset.lastUpdate}` : undefined,
      dataset.badges.length > 0 ? `Badges: ${dataset.badges.join(", ")}` : undefined,
      dataset.schema ? `Declared schema: ${dataset.schema.name}` : undefined,
      `URL: ${dataset.url}`,
      "",
      `Resources: ${dataset.resources.length} (main: ${mainCount}, documentation: ${docCount})${
        dataset.resources.length > MAX_LISTED ? ` — first ${MAX_LISTED} analysed` : ""
      }`,
      latest ? `Latest file modification: ${latest}` : undefined,
      "",
      "By format family:",
      ...[...groups.entries()].map(
        ([family, g]) =>
          `  - ${family}: ${g.ids.length} file(s), formats ${[...g.formats].join("/")}${
            g.known ? `, ${humanSize(g.bytes)}` : ""
          }`,
      ),
      "",
      recommended
        ? `Start with: "${recommended.title}" (resource_id=${recommended.resource_id}) → ${recommended.tool}. ${recommended.reason}`
        : "No resource with a usable access path was found.",
      "",
      "Resources:",
    ];
    resources.forEach((r, i) => {
      const report = reports[i];
      lines.push(
        `  ${i + 1}. ${r.title || "Untitled"} [${report?.detectedFormat || r.format || "?"}${
          r.filesize ? `, ${humanSize(r.filesize)}` : ""
        }${r.type !== "main" ? `, ${r.type}` : ""}] id=${r.id}${
          report ? ` → ${report.primary} (${recommendationFor(report.primary).tool})` : ""
        }`,
      );
    });

    return {
      text: lines.filter((l): l is string => l !== undefined).join("\n"),
      structured: {
        dataset: {
          id: dataset.id,
          slug: dataset.slug,
          title: dataset.title,
          description_short: dataset.descriptionShort,
          organization: dataset.organization?.name,
          url: dataset.url,
          last_update: dataset.lastUpdate,
          license: dataset.license,
          badges: dataset.badges,
          schema: dataset.schema,
        },
        resources_total: dataset.resources.length,
        main_resources: mainCount,
        documentation_resources: docCount,
        latest_modification: latest,
        groups: [...groups.entries()].map(([family, g]) => ({
          family,
          count: g.ids.length,
          formats: [...g.formats],
          total_bytes: g.known ? g.bytes : undefined,
          resource_ids: g.ids,
        })),
        recommended,
        resources: resources.map((r, i) => resourceSummaryToStructured(r, reports[i])),
      },
      howToGetMore: "Use list_dataset_resources with page/page_size for the complete list.",
    };
  },
});
