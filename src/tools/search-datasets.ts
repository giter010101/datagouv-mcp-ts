import { z } from "zod";
import type { DatasetSearchFilters } from "../clients/types.js";
import { truncate } from "../core/text.js";
import type { DatasetSummary, Page } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { datasetSummarySchema, pageOutputShape } from "./shared/output-schemas.js";
import { cleanSearchQuery } from "./shared/search-query.js";
import { defineTool } from "./types.js";

export const LAST_UPDATE_RANGES = ["last_30_days", "last_12_months", "last_3_years"] as const;

export const searchDatasetsInputShape = {
  query: z
    .string()
    .min(1)
    .describe("Search keywords (short and specific; the API uses AND logic)."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  page_size: z.number().int().min(1).max(100).default(20).describe("Results per page (max 100)."),
  sort: z
    .string()
    .optional()
    .describe(
      "Sort field: created, last_update, reuses, followers, views. Prefix with '-' for descending (e.g. -last_update).",
    ),
  last_update_range: z
    .enum(LAST_UPDATE_RANGES)
    .optional()
    .describe("Only datasets updated recently: last_30_days, last_12_months or last_3_years."),
  organization: z
    .string()
    .optional()
    .describe("Organization ID facet (id, not slug; e.g. INSEE is 61937d50e54eade2bbf8e8df)."),
  tag: z.string().optional().describe("Tag slug facet. Comma-separated for several tags (ANDed)."),
  license: z.string().optional().describe("License slug facet (e.g. fr-lo)."),
  format: z
    .string()
    .optional()
    .describe(
      "Resource format facet (e.g. csv). Matches datasets that have at least one resource of that format.",
    ),
  badge: z
    .string()
    .optional()
    .describe("Dataset badge facet: hvd, inspire, spd, sr (e.g. hvd for High Value Datasets)."),
  geozone: z
    .string()
    .optional()
    .describe("Spatial geozone id (e.g. country:fr, fr:departement:75)."),
  granularity: z
    .string()
    .optional()
    .describe("Spatial granularity (e.g. commune, department, other)."),
  schema: z
    .string()
    .optional()
    .describe("schema.data.gouv.fr name (e.g. etalab/schema-irve-statique)."),
  topic: z.string().optional().describe("Topic id facet."),
};

export const searchDatasetsOutputShape = {
  query: z.string(),
  effective_query: z.string().describe("Query actually sent after stop-word cleaning / fallback."),
  ...pageOutputShape,
  datasets: z.array(datasetSummarySchema),
};

export const searchDatasetsTool = defineTool<typeof searchDatasetsInputShape, ToolDeps>({
  name: "search_datasets",
  title: "Search datasets",
  legacy: true,
  description: [
    "Search for datasets on data.gouv.fr by keywords.",
    "",
    "This is typically the first step in exploring data.gouv.fr.",
    "Use short, specific queries (the API uses AND logic, so generic words",
    'like "données" or "fichier" may return zero results).',
    "",
    "Use `sort` to order results. Accepted values: created, last_update,",
    "reuses, followers, views. Optionally prefixed with '-' for descending",
    "(e.g. -last_update). Use `last_update_range` to restrict",
    "results to recently updated datasets: last_30_days, last_12_months,",
    "last_3_years.",
    "",
    "Optional facets narrow the search: organization, tag, license, format, badge (e.g. 'hvd'),",
    "geozone, granularity, schema, topic. Facets are ANDed with the keywords.",
    "",
    "Returns the total match count, the current page and for each dataset: title, ID,",
    "short description, organization, tags, resource count and URL.",
    "Typical workflow: search_datasets → get_dataset_resources_summary (or list_dataset_resources) → query_resource / preview_resource.",
  ].join("\n"),
  inputSchema: searchDatasetsInputShape,
  outputSchema: searchDatasetsOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const filters = toSearchFilters(input);
    const cleaned = cleanSearchQuery(input.query);
    let usedQuery = cleaned === "" ? input.query : cleaned;
    let result = await ctx.deps.datagouv.searchDatasets({
      query: usedQuery,
      page: input.page,
      pageSize: input.page_size,
      sort: input.sort,
      lastUpdateRange: input.last_update_range,
      filters,
    });

    // Legacy behaviour: if stop-word cleaning yields nothing, retry with the original query.
    if (result.items.length === 0 && usedQuery !== input.query) {
      ctx.log.debug({ cleaned: usedQuery, original: input.query }, "retrying with original query");
      usedQuery = input.query;
      result = await ctx.deps.datagouv.searchDatasets({
        query: usedQuery,
        page: input.page,
        pageSize: input.page_size,
        sort: input.sort,
        lastUpdateRange: input.last_update_range,
        filters,
      });
    }

    return {
      text: formatSearchResults(input.query, result),
      structured: {
        query: input.query,
        effective_query: usedQuery,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        datasets: result.items.map(datasetToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

export function toSearchFilters(input: {
  organization?: string;
  tag?: string;
  license?: string;
  format?: string;
  badge?: string;
  geozone?: string;
  granularity?: string;
  schema?: string;
  topic?: string;
}): DatasetSearchFilters | undefined {
  const tags = input.tag
    ?.split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const filters: DatasetSearchFilters = {
    organization: input.organization,
    tag: tags && tags.length > 0 ? tags : undefined,
    license: input.license,
    format: input.format,
    badge: input.badge,
    geozone: input.geozone,
    granularity: input.granularity,
    schema: input.schema,
    topic: input.topic,
  };
  return Object.values(filters).some((v) => v !== undefined) ? filters : undefined;
}

export function datasetToStructured(ds: DatasetSummary) {
  return {
    id: ds.id,
    slug: ds.slug,
    title: ds.title,
    description_short: ds.descriptionShort,
    organization: ds.organization?.name,
    organization_id: ds.organization?.id,
    tags: ds.tags,
    resources_count: ds.resourcesCount,
    last_update: ds.lastUpdate,
    license: ds.license,
    url: ds.url,
  };
}

export function formatSearchResults(query: string, result: Page<DatasetSummary>): string {
  if (result.items.length === 0) return `No datasets found for query: '${query}'`;

  const lines: string[] = [
    `Found ${result.total} dataset(s) for query: '${query}'`,
    `Page ${result.page} of results:`,
    "",
  ];
  result.items.forEach((ds, index) => {
    lines.push(`${index + 1}. ${ds.title || "Untitled"}`);
    lines.push(`   ID: ${ds.id}`);
    if (ds.descriptionShort) lines.push(`   Description: ${truncate(ds.descriptionShort, 200)}`);
    if (ds.organization) lines.push(`   Organization: ${ds.organization.name}`);
    if (ds.tags.length > 0) lines.push(`   Tags: ${ds.tags.slice(0, 5).join(", ")}`);
    lines.push(`   Resources: ${ds.resourcesCount}`);
    lines.push(`   URL: ${ds.url}`);
    lines.push("");
  });
  if (result.hasNext) lines.push(`More results available: use page=${result.page + 1}.`);
  return lines.join("\n").trimEnd();
}
