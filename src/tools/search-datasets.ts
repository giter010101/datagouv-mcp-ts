import { z } from "zod";
import type { DatagouvSearchClient } from "../clients/datagouv-client.js";
import { truncate } from "../core/text.js";
import type { DatasetSummary, Page } from "../core/types.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { cleanSearchQuery } from "./shared/search-query.js";
import { defineTool } from "./types.js";

export interface SearchDatasetsDeps {
  datagouv: DatagouvSearchClient;
}

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
};

export const searchDatasetsTool = defineTool<typeof searchDatasetsInputShape, SearchDatasetsDeps>({
  name: "search_datasets",
  title: "Search datasets",
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
    "Returns the total match count, the current page and for each dataset: title, ID,",
    "short description, organization, tags, resource count and URL.",
    "Typical workflow: search_datasets → list_dataset_resources → query_resource_data.",
  ].join("\n"),
  inputSchema: searchDatasetsInputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const baseParams = {
      page: input.page,
      pageSize: input.page_size,
      sort: input.sort,
      lastUpdateRange: input.last_update_range,
    };

    const cleaned = cleanSearchQuery(input.query);
    let usedQuery = cleaned === "" ? input.query : cleaned;
    let result = await ctx.deps.datagouv.searchDatasets({ ...baseParams, query: usedQuery });

    // Legacy behaviour: if stop-word cleaning yields nothing, retry with the original query.
    if (result.items.length === 0 && usedQuery !== input.query) {
      ctx.log.debug({ cleaned: usedQuery, original: input.query }, "retrying with original query");
      usedQuery = input.query;
      result = await ctx.deps.datagouv.searchDatasets({ ...baseParams, query: usedQuery });
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
        datasets: result.items.map(toStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

function toStructured(ds: DatasetSummary) {
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
