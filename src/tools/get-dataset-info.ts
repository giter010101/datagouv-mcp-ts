import { z } from "zod";
import { truncate } from "../core/text.js";
import type { DatasetDetail } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { DETAIL_DESCRIPTION_CHARS, DETAIL_TAGS_MAX, kv, lines } from "./shared/formatters.js";
import { getDatasetOrThrow } from "./shared/resource-access.js";
import { defineTool } from "./types.js";

export const getDatasetInfoInputShape = {
  dataset_id: z.string().min(1).describe("Dataset ID (24-hex) or slug."),
};

export const datasetDetailSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  url: z.string(),
  description_short: z.string(),
  description: z.string().describe("Full description, truncated to 500 characters."),
  organization: z.string().optional(),
  organization_id: z.string().optional(),
  tags: z.array(z.string()),
  badges: z.array(z.string()),
  resources_count: z.number().int(),
  created_at: z.string().optional(),
  last_update: z.string().optional(),
  license: z.string().optional(),
  frequency: z.string().optional(),
  temporal_coverage: z.object({ start: z.string(), end: z.string() }).optional(),
  spatial: z
    .object({ zones: z.array(z.string()), granularity: z.string().optional() })
    .optional(),
  schema: z
    .object({ name: z.string(), version: z.string().optional(), url: z.string().optional() })
    .optional(),
});

export const getDatasetInfoTool = defineTool<typeof getDatasetInfoInputShape, ToolDeps>({
  name: "get_dataset_info",
  title: "Get dataset info",
  legacy: true,
  description: [
    "Get detailed metadata about a specific dataset.",
    "",
    "Returns title, description, organization, tags, resource count,",
    "creation/update dates, and license information, plus badges (e.g. hvd),",
    "update frequency, temporal/spatial coverage and the declared schema when present.",
    "Accepts the dataset ID or its slug. To see the files themselves, call",
    "get_dataset_resources_summary (recommended) or list_dataset_resources.",
  ].join("\n"),
  inputSchema: getDatasetInfoInputShape,
  outputSchema: { dataset: datasetDetailSchema },
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const dataset = await getDatasetOrThrow(ctx.deps, input.dataset_id);
    return {
      text: formatDatasetDetail(dataset),
      structured: { dataset: datasetDetailToStructured(dataset) },
    };
  },
});

export function datasetDetailToStructured(ds: DatasetDetail) {
  return {
    id: ds.id,
    slug: ds.slug,
    title: ds.title,
    url: ds.url,
    description_short: ds.descriptionShort,
    description: truncate(ds.description, DETAIL_DESCRIPTION_CHARS),
    organization: ds.organization?.name,
    organization_id: ds.organization?.id,
    tags: ds.tags.slice(0, DETAIL_TAGS_MAX),
    badges: ds.badges,
    resources_count: ds.resources.length || ds.resourcesCount,
    created_at: ds.createdAt,
    last_update: ds.lastUpdate,
    license: ds.license,
    frequency: ds.frequency,
    temporal_coverage: ds.temporalCoverage,
    spatial: ds.spatial,
    schema: ds.schema,
  };
}

export function formatDatasetDetail(ds: DatasetDetail): string {
  const fullDiffers = ds.description && ds.description !== ds.descriptionShort;
  return lines(
    `Dataset Information: ${ds.title || "Unknown"}`,
    "",
    kv("ID", ds.id),
    kv("Slug", ds.slug),
    kv("URL", ds.url),
    ds.descriptionShort ? "" : undefined,
    ds.descriptionShort ? `Description: ${ds.descriptionShort}` : undefined,
    fullDiffers ? "" : undefined,
    fullDiffers ? `Full description: ${truncate(ds.description, DETAIL_DESCRIPTION_CHARS)}` : undefined,
    ds.organization ? "" : undefined,
    ds.organization ? `Organization: ${ds.organization.name}` : undefined,
    ds.organization ? `  Organization ID: ${ds.organization.id}` : undefined,
    ds.tags.length > 0 ? "" : undefined,
    kv("Tags", ds.tags.slice(0, DETAIL_TAGS_MAX)),
    kv("Badges", ds.badges),
    "",
    `Resources: ${ds.resources.length || ds.resourcesCount} file(s)`,
    ds.createdAt || ds.lastUpdate ? "" : undefined,
    kv("Created", ds.createdAt),
    kv("Last updated", ds.lastUpdate),
    ds.license || ds.frequency ? "" : undefined,
    kv("License", ds.license),
    kv("Update frequency", ds.frequency),
    ds.temporalCoverage ? `Temporal coverage: ${ds.temporalCoverage.start} → ${ds.temporalCoverage.end}` : undefined,
    ds.spatial?.granularity ? `Spatial granularity: ${ds.spatial.granularity}` : undefined,
    ds.spatial && ds.spatial.zones.length > 0 ? `Spatial zones: ${ds.spatial.zones.slice(0, 10).join(", ")}` : undefined,
    ds.schema ? `Schema: ${ds.schema.name}${ds.schema.version ? ` (v${ds.schema.version})` : ""}` : undefined,
  );
}
