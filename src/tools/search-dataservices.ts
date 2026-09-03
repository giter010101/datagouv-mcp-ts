import { z } from "zod";
import { truncate } from "../core/text.js";
import type { DataserviceSummary, Page } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { LIST_DESCRIPTION_CHARS, LIST_TAGS_MAX } from "./shared/formatters.js";
import { pageOutputShape } from "./shared/output-schemas.js";
import { cleanSearchQuery } from "./shared/search-query.js";
import { defineTool } from "./types.js";

export const searchDataservicesInputShape = {
  query: z.string().min(1).describe("Search keywords (short and specific; AND logic)."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  page_size: z.number().int().min(1).max(100).default(20).describe("Results per page (max 100)."),
};

export const dataserviceSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description_short: z.string(),
  organization: z.string().optional(),
  organization_id: z.string().optional(),
  base_api_url: z.string().optional(),
  machine_documentation_url: z.string().optional(),
  tags: z.array(z.string()),
  url: z.string(),
});

export const searchDataservicesOutputShape = {
  query: z.string(),
  effective_query: z.string(),
  ...pageOutputShape,
  dataservices: z.array(dataserviceSummarySchema),
};

export const searchDataservicesTool = defineTool<typeof searchDataservicesInputShape, ToolDeps>({
  name: "search_dataservices",
  title: "Search third-party APIs",
  legacy: true,
  description: [
    "Search for third-party APIs (dataservices) on data.gouv.fr by keywords.",
    "",
    "Third-party APIs (or dataservices) are APIs registered in the data.gouv.fr catalog",
    "that provide programmatic access to data (unlike datasets which are static files).",
    "Use short, specific queries (the API uses AND logic, so generic words",
    'like "données" or "fichier" may return zero results).',
    "",
    "Returns for each API: title, ID, short description, organization, base API URL, tags, catalogue URL.",
    "Typical workflow: search_dataservices → get_dataservice_info →",
    "get_dataservice_openapi_spec → call the API using base_api_url per spec.",
  ].join("\n"),
  inputSchema: searchDataservicesInputShape,
  outputSchema: searchDataservicesOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const base = { page: input.page, pageSize: input.page_size };
    const cleaned = cleanSearchQuery(input.query);
    let usedQuery = cleaned === "" ? input.query : cleaned;
    let result = await ctx.deps.datagouv.searchDataservices({ ...base, query: usedQuery });
    if (result.items.length === 0 && usedQuery !== input.query) {
      ctx.log.debug({ cleaned: usedQuery, original: input.query }, "retrying with original query");
      usedQuery = input.query;
      result = await ctx.deps.datagouv.searchDataservices({ ...base, query: usedQuery });
    }
    return {
      text: formatDataservices(input.query, result),
      structured: {
        query: input.query,
        effective_query: usedQuery,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        dataservices: result.items.map(dataserviceToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

export function dataserviceToStructured(ds: DataserviceSummary) {
  return {
    id: ds.id,
    title: ds.title,
    description_short: truncate(ds.description, LIST_DESCRIPTION_CHARS),
    organization: ds.organization?.name,
    organization_id: ds.organization?.id,
    base_api_url: ds.baseApiUrl,
    machine_documentation_url: ds.machineDocumentationUrl,
    tags: ds.tags,
    url: ds.url,
  };
}

export function formatDataservices(query: string, result: Page<DataserviceSummary>): string {
  if (result.items.length === 0) return `No third-party APIs found for query: '${query}'`;
  const lines = [
    `Found ${result.total} third-party API(s) for query: '${query}'`,
    `Page ${result.page} of results:`,
    "",
  ];
  result.items.forEach((ds, index) => {
    lines.push(`${index + 1}. ${ds.title || "Untitled"}`);
    lines.push(`   ID: ${ds.id}`);
    if (ds.description) lines.push(`   Description: ${truncate(ds.description, LIST_DESCRIPTION_CHARS)}`);
    if (ds.organization) lines.push(`   Organization: ${ds.organization.name}`);
    if (ds.baseApiUrl) lines.push(`   Base API URL: ${ds.baseApiUrl}`);
    if (ds.tags.length > 0) lines.push(`   Tags: ${ds.tags.slice(0, LIST_TAGS_MAX).join(", ")}`);
    lines.push(`   URL: ${ds.url}`);
    lines.push("");
  });
  if (result.hasNext) lines.push(`More results available: use page=${result.page + 1}.`);
  return lines.join("\n").trimEnd();
}
