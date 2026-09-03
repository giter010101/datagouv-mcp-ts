import { z } from "zod";
import type { OrganizationSummary, Page } from "../core/types.js";
import type { ToolDeps } from "./deps.js";
import { READ_ONLY_EXTERNAL_API_TOOL } from "./shared/annotations.js";
import { pageOutputShape } from "./shared/output-schemas.js";
import { cleanSearchQuery } from "./shared/search-query.js";
import { defineTool } from "./types.js";

export const ORGANIZATION_BADGES = [
  "public-service",
  "certified",
  "association",
  "company",
  "local-authority",
] as const;

export const searchOrganizationsInputShape = {
  query: z
    .string()
    .default("")
    .describe("Keywords (acronym, ministry, city, 'INSEE'…). Empty string = browse the catalogue."),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)."),
  page_size: z.number().int().min(1).max(100).default(20).describe("Results per page (max 100)."),
  sort: z
    .string()
    .optional()
    .describe(
      "Sort field: name, datasets, reuses, followers, views, created, last_modified; prefix with '-' for descending (e.g. -datasets).",
    ),
  badge: z
    .string()
    .optional()
    .describe("Publisher type: public-service, certified, association, company, local-authority."),
  name: z.string().optional().describe("Exact organization name filter."),
  business_number_id: z.string().optional().describe("SIREN / business identifier filter."),
};

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  acronym: z.string().optional(),
  badges: z.array(z.string()),
  metrics: z.record(z.string(), z.number()).optional(),
  url: z.string(),
});

export const searchOrganizationsOutputShape = {
  query: z.string(),
  effective_query: z.string(),
  filters: z.record(z.string(), z.string()),
  ...pageOutputShape,
  organizations: z.array(organizationSchema),
};

export const searchOrganizationsTool = defineTool<typeof searchOrganizationsInputShape, ToolDeps>({
  name: "search_organizations",
  title: "Search organizations",
  legacy: true,
  description: [
    "Find publishing organizations on data.gouv.fr (who publishes datasets and",
    "reuses).",
    "",
    "Pass a short `query` with distinctive words (acronym, ministry name, city,",
    '"INSEE", etc.). Generic or very broad terms often return large result sets;',
    "combine with `page` / `page_size` or add `badge` / `name` / `business_number_id`",
    "when you need a narrow list.",
    "",
    "Leave `query` empty to list organizations with pagination (same as browsing",
    "the catalog). Use `sort` to order results (e.g. name, datasets, reuses,",
    "followers, views, created, last_modified, or the same with a leading '-' for",
    "descending, such as -datasets).",
    "",
    "`badge` filters by publisher type: public-service, certified, association,",
    "company, local-authority.",
    "",
    "The reply includes how many organizations matched, the current page, and for",
    "each hit: name (and acronym if any), id, slug, badges, optional usage",
    "metrics, and links to the organization page.",
    "Next step: pass the organization `id` as the `organization` facet of search_datasets.",
  ].join("\n"),
  inputSchema: searchOrganizationsInputShape,
  outputSchema: searchOrganizationsOutputShape,
  annotations: READ_ONLY_EXTERNAL_API_TOOL,
  async handler(input, ctx) {
    const base = {
      page: input.page,
      pageSize: input.page_size,
      sort: input.sort,
      badge: input.badge,
      name: input.name,
      businessNumberId: input.business_number_id,
    };
    const cleaned = input.query ? cleanSearchQuery(input.query) : "";
    let usedQuery = cleaned;
    let result = await ctx.deps.datagouv.searchOrganizations({
      ...base,
      query: usedQuery || undefined,
    });
    if (result.items.length === 0 && cleaned !== input.query && input.query) {
      ctx.log.debug({ cleaned, original: input.query }, "retrying with original query");
      usedQuery = input.query;
      result = await ctx.deps.datagouv.searchOrganizations({ ...base, query: usedQuery });
    }

    const filters: Record<string, string> = {};
    if (input.badge) filters.badge = input.badge;
    if (input.name) filters.name = input.name;
    if (input.business_number_id) filters.business_number_id = input.business_number_id;
    if (input.sort) filters.sort = input.sort;

    return {
      text: formatOrganizations(input.query, filters, result),
      structured: {
        query: input.query,
        effective_query: usedQuery,
        filters,
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
        has_next: result.hasNext,
        organizations: result.items.map(organizationToStructured),
      },
      howToGetMore: result.hasNext ? `Call again with page=${result.page + 1}.` : undefined,
    };
  },
});

export function organizationToStructured(org: OrganizationSummary) {
  const metrics = org.metrics
    ? Object.fromEntries(
        Object.entries(org.metrics).filter((e): e is [string, number] => typeof e[1] === "number"),
      )
    : undefined;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    acronym: org.acronym,
    badges: org.badges,
    metrics,
    url: org.url,
  };
}

export function formatOrganizations(
  query: string,
  filters: Record<string, string>,
  result: Page<OrganizationSummary>,
): string {
  if (result.items.length === 0) {
    return `No organizations found for ${query ? `query '${query}'` : "current filters"}`;
  }
  const bits = [
    ...(query ? [`query '${query}'`] : []),
    ...Object.entries(filters).map(([k, v]) => `${k}=${v}`),
  ];
  const lines = [
    `Found ${result.total} organization(s) (${bits.length > 0 ? bits.join(", ") : "browse (no text query)"})`,
    `Page ${result.page} of results:`,
    "",
  ];
  result.items.forEach((org, index) => {
    const title = org.acronym ? `${org.name || "Untitled"} (${org.acronym})` : org.name || "Untitled";
    lines.push(`${index + 1}. ${title}`);
    lines.push(`   ID: ${org.id}`);
    if (org.slug) lines.push(`   Slug: ${org.slug}`);
    if (org.badges.length > 0) lines.push(`   Badges: ${org.badges.join(", ")}`);
    if (org.metrics) {
      const parts = Object.entries(org.metrics)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`);
      if (parts.length > 0) lines.push(`   Metrics: ${parts.join(", ")}`);
    }
    lines.push(`   URL: ${org.url}`);
    lines.push("");
  });
  if (result.hasNext) lines.push(`More results available: use page=${result.page + 1}.`);
  return lines.join("\n").trimEnd();
}
